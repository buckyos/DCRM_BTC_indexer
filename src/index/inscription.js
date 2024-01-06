const assert = require('assert');
const { BTCClient } = require('../btc/btc');
const { OrdClient } = require('../btc/ord');
const { Util } = require('../util');
const { TokenIndex } = require('./token');
const { ETHIndex } = require('../eth/index');
const { InscriptionTransferMonitor } = require('./monitor');
const { InscriptionsManager } = require('../storage/manager');
const {
    InscriptionContentLoader,
    InscriptionNewItem,
    BlockInscriptionCollector,
} = require('./item');
const { StateStorage } = require('../storage/state');

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
        this.state_storage = new StateStorage(dir);

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
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (this.current_block_height === 0) {
                // get latest block height already synced
                let { ret, height } =
                    await this.state_storage.get_btc_latest_block_height();
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

                // should skip the last synced block height, so we add 1
                height += 1;

                this.current_block_height =
                    height > this.config.token.genesis_block_height
                        ? height
                        : this.config.token.genesis_block_height;
                console.info(
                    `btc inscriptions sync will start at block height ${this.current_block_height}`,
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

    /**
     * @comment get the latest block height of btc and ord, use the smaller one
     * @returns {Promise<{ret: number, height: number}>}
     */
    async _get_latest_block_height() {
        const { ret, height } = await this.btc_client.get_latest_block_height();
        if (ret !== 0) {
            console.error(`failed to get latest block height`);
            return { ret };
        }

        assert(_.isNumber(height), `invalid block height ${height}`);
        // get ord latest block height
        const { ret: ord_ret, height: ord_height } =
            await this.ord_client.get_latest_block_height();
        if (ord_ret !== 0) {
            console.error(`failed to get ord latest block height`);
            return { ret: ord_ret };
        }

        assert(
            _.isNumber(ord_height),
            `invalid ord block height ${ord_height}`,
        );

        // if block height diff is too large, we should warn
        if (Math.abs(height - ord_height) > 10) {
            console.warn(
                `btc block height ${height} and ord block height ${ord_height} diff is too large`,
            );
        }

        // use the smaller one
        if (height > ord_height) {
            return { ret: 0, height: ord_height };
        } else {
            return { ret: 0, height };
        }
    }

    // sync once
    async sync_once() {
        const { ret, height } = await this._get_latest_block_height();
        if (ret !== 0) {
            console.error(`failed to get latest block height`);
            return { ret };
        }

        assert(_.isNumber(height), `invalid block height ${height}`);
        assert(
            _.isNumber(this.current_block_height),
            `invalid block height ${this.current_block_height}`,
        );

        if (this.current_block_height > height) {
            if (this.current_block_height > height + 1) {
                console.warn(
                    `current block height ${
                        this.current_block_height
                    } > latest block height ${height + 1}`,
                );
            }

            return { ret: 0 };
        }

        {
            const begin = this.current_block_height;
            const { ret } = await this.sync_blocks(begin, height);
            if (ret !== 0) {
                console.error(`failed to sync blocks [${begin}, ${height}])`);
                return { ret };
            }
        }

        assert(
            this.current_block_height == height + 1,
            `invalid synced block height ${this.current_block_height} != ${
                height + 1
            }`,
        );
        return { ret: 0 };
    }

    // try sync block for range [begin, end]
    async sync_blocks(begin, end) {
        console.assert(begin <= end, `invalid block range [${begin}, ${end})`);

        for (let i = begin; i <= end; i++) {
            const { ret } = await this.sync_block(i);
            if (ret !== 0) {
                console.error(`failed to sync block ${i}`);
                return { ret };
            }

            // update latest block height
            {
                const { ret } =
                    await this.state_storage.update_btc_latest_block_height(i);
                if (ret !== 0) {
                    console.error(`failed to update latest block height ${i}`);
                    return { ret };
                }
            }

            // update current block height immediately after synced
            this.current_block_height = i + 1;
        }

        return { ret: 0 };
    }

    async sync_block(block_height) {
        console.info(`syncing block ${block_height}`);

        const collector = new BlockInscriptionCollector(block_height, [], []);

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
                `synced block and no known inscriptions and transfers found ${block_height}`,
            );
            return { ret: 0 };
        }

        const inscriptions_transfer_count =
            collector.inscription_transfers.length;

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

        // only remove inscriptions from transfer monitor on block complete
        if (inscriptions_transfer_count > 0) {
            assert(
                inscriptions_transfer_count ===
                    collector.inscription_transfers.length,
                `invalid inscriptions transfer count ${inscriptions_transfer_count} !== ${collector.inscription_transfers.length}`,
            );
            this.monitor.remove_inscriptions_on_block_complete(
                collector.inscription_transfers,
            );
        }

        console.info(
            `synced block with inscriptions: ${collector.new_inscriptions.length}, transfers: ${collector.inscription_transfers.length} ${block_height}`,
        );

        return { ret: 0 };
    }

    /**
     *
     * @param {number} block_height
     * @param {BlockInscriptionCollector} collector
     * @returns {Promise<{ret: number}>}
     */
    async _scan_block_inscription_transfer(block_height, collector) {
        assert(_.isNumber(block_height), `block_height should be number`);
        assert(
            collector instanceof BlockInscriptionCollector,
            `invalid collector`,
        );

        const { ret, transfer_items } = await this.monitor.process_block(
            block_height,
            this.inscription_storage,
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

    /*
    // process all inscriptions created in block one by one
    async _process_block_inscriptions(block_height, collector) {
        assert(block_height != null, `block_height should not be null`);
        assert(
            collector instanceof BlockInscriptionCollector,
            `invalid collector`,
        );

        const { ret, data: inscription_ids } =
            await this.ord_client.get_inscription_by_block(block_height);

        if (ret !== 0) {
            console.error(
                `failed to get inscription by block: ${block_height}`,
            );
            return { ret };
        }

        if (inscription_ids.length === 0) {
            console.info(`no inscriptions in block ${block_height}`);
            return { ret: 0 };
        }

        // get inscriptions by batch
        const { ret: batch_get_inscriptions_ret, inscriptions } =
            await this.ord_client.get_inscription_batch(inscription_ids);
        if (batch_get_inscriptions_ret !== 0) {
            console.error(`failed to get inscriptions by batch`);
            return { ret: batch_get_inscriptions_ret };
        }

        assert(
            inscription_ids.length === inscriptions.length,
            `invalid inscriptions length`,
        );

        // process inscriptions in block
        for (let i = 0; i < inscriptions.length; i++) {
            const inscription = inscriptions[i];
            const inscription_id = inscription_ids[i];
            assert(
                inscription.inscription_id == inscription_id,
                `invalid inscription id ${inscription.inscription_id} !== ${inscription_id}`,
            );

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
                this.config,
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

            assert(_.isObject(content), `invalid inscription content`);
            assert(_.isObject(op), `invalid inscription op item`);

            // get creator address and satpoint info
            const {
                ret: get_address_ret,
                satpoint: creator_satpoint,
                address: creator_address,
                value: creator_value,
                commit_txid,
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
                commit_txid,
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
    */

    // process all inscriptions created in block by batch
    async _process_block_inscriptions(block_height, collector) {
        assert(block_height != null, `block_height should not be null`);
        assert(
            collector instanceof BlockInscriptionCollector,
            `invalid collector`,
        );

        const { ret, data: inscription_ids } =
            await this.ord_client.get_inscription_by_block(block_height);

        if (ret !== 0) {
            console.error(
                `failed to get inscription by block: ${block_height}`,
            );
            return { ret };
        }

        if (inscription_ids.length === 0) {
            console.info(`no inscriptions in block ${block_height}`);
            return { ret: 0 };
        }

        // get inscriptions by batch
        const { ret: batch_get_inscriptions_ret, inscriptions } =
            await this.ord_client.get_inscription_batch(inscription_ids);
        if (batch_get_inscriptions_ret !== 0) {
            console.error(`failed to get inscriptions by batch`);
            return { ret: batch_get_inscriptions_ret };
        }

        assert(
            inscription_ids.length === inscriptions.length,
            `invalid inscriptions length`,
        );

        // load inscriptions content in batch
        const { ret: load_content, results } =
            await this._load_inscriptions_content(inscriptions);
        if (load_content !== 0) {
            console.error(`failed to load inscriptions content`);
            return { ret: load_content };
        }

        for (let i = 0; i < results.length; i++) {
            const {
                ret: load_ret,
                valid,
                content,
                op,
                inscription,
            } = results[i];
            assert(load_ret === 0, `invalid load_ret`);

            const inscription_id = inscription.inscription_id;

            // we only process inscribe op that we interested
            if (!valid) {
                // console.warn(`invalid inscription content ${inscription_id}`);
                continue;
            }

            assert(_.isObject(content), `invalid inscription content`);
            assert(_.isObject(op), `invalid inscription op item`);

            // get creator address and satpoint info
            const {
                ret: get_address_ret,
                satpoint: creator_satpoint,
                address: creator_address,
                value: creator_value,
                commit_txid,
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
                commit_txid,
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

    /**
     *
     * @param {Array<object} inscriptions
     * @returns {Promise<{ret: number, results: Array<object>}>}
     */
    async _load_inscriptions_content(inscriptions) {
        // process in batch size 64
        const batch_size = 64;
        const content = [];
        for (let i = 0; i < inscriptions.length; i += batch_size) {
            let end = i + batch_size;
            if (end > inscriptions.length) {
                end = inscriptions.length;
            }

            const batch_inscriptions = inscriptions.slice(i, end);
            const { ret, results } =
                await this._load_inscriptions_content_batch(batch_inscriptions);
            if (ret !== 0) {
                console.error(`failed to load inscription content in batch`);
                return { ret };
            }

            content.push(...results);
        }

        return { ret: 0, results: content };
    }

    async _load_inscriptions_content_batch(inscriptions) {
        assert(_.isArray(inscriptions), `invalid inscriptions`);
        assert(inscriptions.length > 0, `invalid inscriptions length`);

        const promises = inscriptions.map((inscription) =>
            InscriptionContentLoader.load_content(
                this.ord_client,
                inscription.inscription_id,
                inscription.content_type,
                this.config,
            ),
        );

        try {
            const results = await Promise.all(promises);

            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                if (result.ret !== 0) {
                    console.error(
                        `failed to load inscription content ${inscriptions[i].inscription_id}`,
                    );
                    return { ret: result.ret };
                }

                result.inscription = inscriptions[i];
            }

            return { ret: 0, results };
        } catch (error) {
            console.error(
                `failed to load inscription content in batch ${error}`,
            );
            return { ret: -1 };
        }
    }

    // new inscription event
    /**
     * @param {number} block_height
     * @param {InscriptionNewItem} inscription_new_item
     */
    async _on_new_inscription(block_height, inscription_new_item) {
        assert(block_height != null, `block_height should not be null`);
        assert(
            inscription_new_item instanceof InscriptionNewItem,
            `invalid inscription_new_item`,
        );
        assert(
            _.isObject(inscription_new_item),
            `invalid inscription_new_item`,
        );
        assert(
            _.isObject(inscription_new_item.op),
            `invalid inscription_new_item.op`,
        );

        // first record new inscription
        const { ret: add_new_inscription_ret } =
            await this.inscription_storage.add_new_inscription(
                inscription_new_item.inscription_id,
                inscription_new_item.inscription_number,
                
                inscription_new_item.block_height,
                inscription_new_item.timestamp,
                inscription_new_item.satpoint.to_string(),
                inscription_new_item.commit_txid,
                inscription_new_item.value,
                
                JSON.stringify(inscription_new_item.content),
                inscription_new_item.op.op,

                inscription_new_item.address,
            );
        if (add_new_inscription_ret !== 0) {
            console.error(
                `failed to add new inscription ${inscription_new_item.inscription_id}`,
            );
            return { ret: add_new_inscription_ret };
        }

        // then record inscription transfer and monitor it
        const { ret: add_ret } = await this.monitor.add_new_inscription(
            inscription_new_item.inscription_id,
            inscription_new_item.inscription_number,
            block_height,
            inscription_new_item.timestamp,
            inscription_new_item.address,
            inscription_new_item.satpoint,
            inscription_new_item.value,
            inscription_new_item.op.op,
        );
        if (add_ret !== 0) {
            console.error(
                `failed to add new inscription creator record ${
                    inscription_new_item.inscription_id
                } ${inscription_new_item.satpoint.to_string()}, ${
                    inscription_new_item.address
                }`,
            );
            return { ret: add_ret };
        }

        return { ret: 0 };
    }

    /**
     * Handles all inscriptions and transfers in a block
     *
     * @param {BlockInscriptionCollector} collector
     * @returns {Promise<{ret: number}>}
     */
    async _on_block_inscriptions_and_transfers(block_height, collector) {
        console.info(
            `indexing inscriptions and transfers at block ${block_height} inscriptions count ${collector.new_inscriptions.length}, transfers count ${collector.inscription_transfers.length}`,
        );

        return await this.token_index.process_block_inscriptions(
            block_height,
            collector,
        );
    }
}

module.exports = { InscriptionIndex, BlockInscriptionCollector };
