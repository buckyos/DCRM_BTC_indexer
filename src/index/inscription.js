const assert = require('assert');
const { BTCClient } = require('../btc/btc');
const { OrdClient } = require('../btc/ord');
const { InscriptionsStorage } = require('../storage/log');
const { Util } = require('../util');
const { TokenIndex } = require('./token');
const { ETHIndex } = require('../eth/index');
const { Util } = require('../util');
const { InscriptionTransferMonitor } = require('./monitor');
const {
    InscriptionContentLoader,
    InscriptionNewItem,
    BlockInscriptonCollector,
} = require('./item');


class InscriptionIndex {
    constructor(config) {
        this.config = config;
        this.btc_client = new BTCClient(
            config.btc.host,
            config.btc.network,
            config.btc.auth,
        );
        this.ord_client = new OrdClient(config.ord.rpc_url);

        // create state storage for index
        const { ret, dir } = Util.get_data_dir(config);
        if (ret !== 0) {
            throw new Error(`failed to get data dir`);
        }
        this.state_storage = new InscriptionStateStorage(dir);

        this.inscription_manager = new InscriptionsManager(config);
        this.inscription_storage = this.inscription_manager.inscription_storage;
        this.monitor = new InscriptionTransferMonitor(
            config,
            this.inscription_manager.inscription_transfer_storage,
        );

        this.current_block_height = 0;
        this.token_index = new TokenIndex(config);
    }

    /**
     *
     * @param {ETHIndex} eth_index
     * @returns {Promise<{ret: number}>}
     */
    async init(eth_index) {
        assert(eth_index instanceof ETHIndex, `eth_index should be ETHIndex`);

        // first init state storage
        const { ret: init_state_storage_ret } = await this.state_storage.init();
        if (init_state_storage_ret !== 0) {
            console.error(`failed to init inscription index state storage`);
            return { ret: init_state_storage_ret };
        }

        // then init inscription manager
        const { ret: init_inscription_manager_ret } =
            await this.inscription_manager.init();
        if (init_inscription_manager_ret !== 0) {
            console.error(`failed to init inscription manager`);
            return { ret: init_inscription_manager_ret };
        }

        // then init token index
        const { ret: init_token_index_ret } = await this.token_index.init(
            eth_index,
        );
        if (init_token_index_ret !== 0) {
            console.error(`failed to init token index`);
            return { ret: init_token_index_ret };
        }

        // then init monitor
        const { ret: init_monitor_ret } = await this.monitor.init();
        if (init_monitor_ret !== 0) {
            console.error(`failed to init inscription monitor`);
            return { ret: init_monitor_ret };
        }

        console.info(`init inscription index success`);
        return { ret: 0 };
    }

    // run forever
    async run() {
        while (true) {
            if (this.current_block_height === 0) {
                // get latest block height already synced
                const { ret, height } =
                    await this.state_storage.get_latest_block_height();
                if (ret !== 0) {
                    console.error(`failed to get latest block height`);
                    await this.sleep(1000 * 5);
                    continue;
                }

                // get config start block height that should be synced
                assert(
                    _.isNumber(this.config.token.genesis_block_height),
                    `invalid start block height`,
                );

                this.current_block_height =
                    height > this.config.token.genesis_block_height
                        ? height
                        : this.config.token.genesis_block_height;
                console.info(
                    `sync will start at block height ${this.current_block_height}`,
                );
            }

            assert(
                this.current_block_height > 0,
                `invalid block height ${this.current_block_height}`,
            );

            const { ret } = await this.sync_once();
            if (ret !== 0) {
                console.error(`failed to sync once`);
                await Util.sleep(1000 * 5);
                continue;
            } else {
                await Util.sleep(1000 * 10);
            }
        }
    }

    // sync once
    async sync_once() {
        const { ret, height } = await this.btc_client.get_latest_block_height();
        if (ret !== 0) {
            console.error(`failed to get latest block height`);
            return { ret };
        }

        assert(_.isNumber(height), `invalid block height ${height}`);
        assert(
            _.isNumber(this.current_block_height),
            `invalid block height ${this.current_block_height}`,
        );

        if (this.current_block_height >= height) {
            console.assert(
                this.current_block_height === height,
                `invalid block height ${this.current_block_height} ${height}`,
            );
            return { ret: 0 };
        }

        {
            const { ret } = await this.sync_blocks(
                this.current_block_height,
                height + 1,
            );
            if (ret !== 0) {
                console.error(
                    `failed to sync blocks [${this.current_block_height}, ${
                        height + 1
                    })`,
                );
                return { ret };
            }
        }

        this.current_block_height = height + 1;
        return { ret: 0 };
    }

    // try sync block for range [begin, end)
    async sync_blocks(begin, end) {
        console.assert(begin < end, `invalid block range [${begin}, ${end})`);

        for (let i = begin; i < end; i++) {
            const { ret } = await this.sync_block(i);
            if (ret !== 0) {
                console.error(`failed to sync block ${i}`);
                return { ret };
            }

            // update latest block height
            {
                const { ret } =
                    await this.state_storage.update_latest_block_height(i);
                if (ret !== 0) {
                    console.error(`failed to update latest block height ${i}`);
                    return { ret };
                }
            }
        }
    }

    async sync_block(block_height) {
        console.info(`syncing block ${block_height}`);

        const collector = new BlockInscriptonCollector(block_height, [], []);

        // first process block inscriptions
        const { ret: process_ret } = await this._process_block_inscriptions(
            block_height,
            collector,
        );
        if (process_ret !== 0) {
            console.error(
                `failed to process inscriptions in block ${block_height}`,
            );
            return { ret: process_ret };
        }

        // then scan block inscription transfer
        const { ret: scan_ret } = await this._scan_block_inscription_transfer(
            block_height,
            collector,
        );
        if (scan_ret !== 0) {
            console.error(
                `failed to scan inscriptions in block ${block_height}`,
            );
            return { ret: scan_ret };
        }

        if (collector.is_empty()) {
            console.info(
                `no inscriptions and transfers in block ${block_height}`,
            );
            return { ret: 0 };
        }

        // process all inscriptions and transfers in block degree
        const { ret } = await this._on_block_inscriptions_and_transfers(
            block_height,
            collector,
        );
        if (ret !== 0) {
            console.error(
                `failed to index inscriptions in block ${block_height}`,
            );
            return { ret };
        }

        console.info(`synced block ${block_height}`);

        return { ret: 0 };
    }

    /**
     *
     * @param {number} block_height
     * @param {BlockInscriptonCollector} collector
     * @returns {Promise<{ret: number}>}
     */
    async _scan_block_inscription_transfer(block_height, collector) {
        assert(_.isNumber(block_height), `block_height should be number`);
        assert(
            collector instanceof BlockInscriptonCollector,
            `invalid collector`,
        );

        const { ret, transfer_items } = await this.monitor.process_block(
            block_height,
        );
        if (ret !== 0) {
            console.error(`failed to process block transfers ${block_height}`);
            return { ret };
        }

        if (transfer_items.length === 0) {
            console.debug(`no transfer in block ${block_height}`);
            return { ret: 0 };
        }

        // update owners
        for (let i = 0; i < transfer_items.length; i++) {
            const transfer_item = transfer_items[i];
            const { ret: transfer_ret } =
                await this.inscription_storage.transfer_owner(
                    transfer_item.inscription_id,
                    block_height,
                    transfer_item.to_address,
                );
            if (transfer_ret !== 0) {
                console.error(
                    `failed to transfer owner of inscription ${transfer_item.inscription_id} to ${transfer_item.to_address}`,
                );
                return { ret: transfer_ret };
            }
        }

        // add to collector for later use
        collector.add_inscription_transfers(transfer_items);

        return { ret: 0 };
    }

    // get all inscriptions created in block
    async _process_block_inscriptions(block_height, collector) {
        assert(block_height != null, `block_height should not be null`);
        assert(
            collector instanceof BlockInscriptonCollector,
            `invalid collector`,
        );

        const { ret, data: inscriptions } =
            await this.ord_client.get_inscription_by_block(block_height);

        if (ret !== 0) {
            console.error(
                `failed to get inscription by block: ${block_height}`,
            );
            return { ret };
        }

        if (inscriptions.length === 0) {
            console.info(`no inscription in block ${block_height}`);
            return { ret: 0 };
        }

        // process inscriptions in block
        for (let i = 0; i < inscriptions.length; i++) {
            const inscription_id = inscriptions[i];

            // fetch inscription by id
            const { ret: get_ret, inscription } =
                await this.ord_client.get_inscription(inscription_id);
            if (get_ret !== 0) {
                console.error(`failed to get inscription ${inscription_id}`);
                return { ret: get_ret };
            }

            assert(
                inscription.genesis_height === block_height,
                `invalid inscription genesis block height: ${inscription.genesis_height} !== ${block_height}`,
            );

            // load content
            const {
                ret: load_ret,
                valid,
                content,
                op,
            } = await InscriptionContentLoader.load_content(
                this.ord_client,
                inscription_id,
                inscription.content_type,
            );
            if (load_ret !== 0) {
                console.error(
                    `failed to load inscription content ${inscription_id}`,
                );
                return { ret: load_ret };
            }

            // we only process inscribe op that we interested
            if (!valid) {
                // console.warn(`invalid inscription content ${inscription_id}`);
                continue;
            }

            assert(content != null, `invalid inscription content`);
            assert(op != null, `invalid inscription op`);

            // get creator address and satpoint info
            const {
                ret: get_address_ret,
                satpoint: creator_satpoint,
                address: creator_address,
                value: creator_value,
            } = await this.monitor.calc_create_satpoint(inscription_id);
            if (get_address_ret !== 0) {
                console.error(
                    `failed to get creator address for ${inscription_id}`,
                );
                return { ret: get_address_ret };
            }

            const new_inscription_item = new InscriptionNewItem(
                inscription_id,
                inscription.inscription_number,
                block_height,
                inscription.timestamp,
                creator_address,
                creator_satpoint,
                creator_value,
                content,
                op,
            );

            // process inscription
            const { ret: process_ret } = await this._on_new_inscription(
                block_height,
                new_inscription_item,
            );
            if (process_ret !== 0) {
                console.error(
                    `failed to process new inscription ${inscription_id}`,
                );
                return { ret: process_ret };
            }

            // add to collector for later use
            collector.new_inscriptions.push(new_inscription_item);
        }

        return { ret: 0 };
    }

    // new inscription event
    /**
     *
     * @param {InscriptionNewItem} inscription_new_item
     * @param {object} op_item
     */
    async _on_new_inscription(block_height, inscription_new_item) {
        assert(block_height != null, `block_height should not be null`);
        assert(
            inscription_new_item instanceof InscriptionNewItem,
            `invalid inscription_new_item`,
        );
        assert(_.isObject(op_item), `invalid op_item`);
        assert(_.isString(op_item.op), `invalid op_item.op`);

        // first record new inscription
        const { ret: add_new_inscription_ret } =
            await this.inscription_storage.add_new_inscription(
                inscription_new_item.inscription_id,
                inscription_new_item.inscription_number,
                inscription_new_item.content,
                inscription_new_item.op,
                inscription_new_item.address,
                block_height,
            );
        if (add_new_inscription_ret !== 0) {
            console.error(
                `failed to add new inscription ${inscription_new_item.inscription_id}`,
            );
            return { ret: add_new_inscription_ret };
        }

        // then record inscription transfer and monitor it
        const { ret: add_ret } = await this.monitor.add_new_inscription(
            inscription_id,
            inscription.inscription_number,
            block_height,
            inscription.timestamp,
            creator_address,
            creator_satpoint,
            creator_value,
        );
        if (add_ret !== 0) {
            console.error(
                `failed to add new inscription creator record ${inscription_id} ${creator_satpoint.to_string()}, ${creator_address}`,
            );
            return { ret: add_ret };
        }

        return { ret: 0 };
    }

    /**
     * Handles all inscriptions and transfers in a block
     *
     * @param {BlockInscriptonCollector} collector
     * @returns {Promise<{ret: number}>}
     */
    async _on_block_inscriptions_and_transfers(block_height, collector) {
        console.info(
            `indexing inscriptions and transfers at block ${block_height} inscriptions count ${collector.new_inscriptions.length} transfers count ${collector.inscription_transfers.length}`,
        );

        return await this.token_index.process_block_inscriptions(
            block_height,
            collector,
        );
    }
}

module.exports = { InscriptionIndex, BlockInscriptonCollector };
