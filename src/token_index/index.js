const { InscriptionsStorageLoader } = require('./loader');
const { ETHIndex } = require('../eth/index');
const { StateStorage } = require('../storage/state');
const { TokenStateStorage } = require('../storage/token_state');
const assert = require('assert');
const { Util } = require('../util');
const { TokenIndex } = require('./token');
const { SYNC_STATE_DB_FILE, INDEX_VERSION } = require('../constants');
const fs = require('fs');
const path = require('path');
const { BTCClient } = require('../btc/btc');
const { OrdClient } = require('../btc/ord');

class InscriptionStateMonitor {
    constructor(config) {
        this.config = config;

        const { ret, dir } = Util.get_data_dir(config);
        if (ret !== 0) {
            throw new Error(`failed to get data dir`);
        }

        this.db_file_path = path.join(dir, SYNC_STATE_DB_FILE);
    }

    // if target db file not exist, wait for it
    async wait_state_storage() {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (fs.existsSync(this.db_file_path)) {
                console.info(
                    `state storage db file ${this.db_file_path} exists`,
                );
                break;
            }
            await Util.sleep(1000);
        }
    }
}

class TokenIndexExecutor {
    constructor(config) {
        this.config = config;
        this.eth_index = new ETHIndex(config);
        this.loader = new InscriptionsStorageLoader(config);

        const { ret, dir } = Util.get_data_dir(config);
        if (ret !== 0) {
            throw new Error(`failed to get data dir`);
        }

        this.inscriptions_state_storage = new StateStorage(dir);
        this.state_storage = new TokenStateStorage(dir);

        this.token_index = new TokenIndex(config);

        this.btc_client = new BTCClient(
            config.btc.host,
            config.btc.network,
            config.btc.auth,
        );
        this.ord_client = new OrdClient(config.ord.rpc_url);


        this.current_block_height = 0;
    }

    async init() {
        const { ret } = await this.loader.init();
        if (ret !== 0) {
            console.error(`failed to init loader`);
            return { ret };
        }

        const { ret: eth_ret } = await this.eth_index.init();
        if (eth_ret !== 0) {
            console.error(`failed to init eth index`);
            return { ret: eth_ret };
        }

        const { ret: state_ret } = await this.inscriptions_state_storage.init();
        if (state_ret !== 0) {
            console.error(`failed to init inscriptions state`);
            return { ret: state_ret };
        }

        const { ret: token_state_ret } = await this.state_storage.init();
        if (token_state_ret !== 0) {
            console.error(`failed to init token state`);
            return { ret: token_state_ret };
        }

        const { ret: token_index_ret } = await this.token_index.init(
            this.eth_index,
        );
        if (token_index_ret !== 0) {
            console.error(`failed to init token index`);
            return { ret: token_index_ret };
        }

        return { ret: 0 };
    }

    async status() {
        // first get btc network latest block height
        const { ret: get_btc_height, height: btc_network_height } =
            await this.btc_client.get_latest_block_height();
        if (get_btc_height !== 0) {
            console.error(`failed to get btc network latest block height`);
            return { ret: get_btc_height };
        }

        // then get btc ord latest block height
        const { ret: get_ord_height, height: btc_ord_height } =
            await this.ord_client.get_latest_block_height();
        if (get_ord_height !== 0) {
            console.error(`failed to get btc ord latest block height`);
            return { ret: get_ord_height };
        }

        // get btc local latest block height
        const { ret, height: btc_local_height } =
            await this.inscriptions_state_storage.get_btc_latest_block_height();
        if (ret !== 0) {
            console.error(`failed to get btc latest block height`);
            return { ret };
        }

        assert(
            _.isNumber(btc_local_height),
            `invalid btc latest block height ${btc_local_height}`,
        );

        // calc percent in 100% format
        const genesis_block_height = this.config.token.genesis_block_height;

        let sync_percent;
        // get min height for btc and ord
        const min_height = Math.min(btc_network_height, btc_ord_height);
        if (btc_local_height >= min_height) {
            sync_percent = 100;
        } else {
            sync_percent =
                ((btc_local_height - genesis_block_height) /
                    (min_height - genesis_block_height)) *
                100;
        }

        let index_percent;
        if (min_height <= this.current_block_height) {
            index_percent = 100;
        } else {
            index_percent =
                ((this.current_block_height - genesis_block_height) /
                    (min_height - genesis_block_height)) *
                100;
        }

        const { ret: get_eth_ret, status: eth_status } = await this.eth_index.status();
        if (get_eth_ret !== 0) {
            console.error(`failed to get eth status`);
            return { ret: get_eth_ret };
        }

        const status = {
            ret: 0,
            version: INDEX_VERSION,
            network: this.config.btc.network,
            genesis_block_height,

            sync: {
                btc: btc_network_height,
                ord: btc_ord_height,
                local: btc_local_height,
                percent: sync_percent.toFixed(2),
            },

            index: {
                sync: min_height,
                local: this.current_block_height - 1,
                percent: index_percent.toFixed(2),
            },

            eth: eth_status,
        };

        return { ret: 0, status };
    }

    async run() {
        const monitor = new InscriptionStateMonitor(this.config);
        await monitor.wait_state_storage();

        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (this.current_block_height === 0) {
                let { ret, height } =
                    await this.state_storage.get_token_latest_block_height();
                if (ret !== 0) {
                    console.error(`failed to get token latest block height`);
                    return { ret };
                }

                // should skip the block that already indexed
                height += 1;

                this.current_block_height =
                    height > this.config.token.genesis_block_height
                        ? height
                        : this.config.token.genesis_block_height;
                console.info(
                    `token inscriptions sync will start at block height ${this.current_block_height}`,
                );
            }

            assert(
                this.current_block_height > 0,
                `invalid token block height ${this.current_block_height}`,
            );

            const { ret } = await this._index_once();
            if (ret !== 0) {
                console.error(`failed to index once`);
                await Util.sleep(1000 * 5);
                continue;
            } else {
                await Util.sleep(1000 * 10);
            }
        }
    }

    async _index_once() {
        const { ret, height } =
            await this.inscriptions_state_storage.get_btc_latest_block_height();
        if (ret !== 0) {
            console.error(`failed to get btc latest block height`);
            return { ret };
        }

        assert(_.isNumber(height), `invalid btc latest block height ${height}`);

        if (this.current_block_height > height) {
            if (this.current_block_height > height + 1) {
                console.warn(
                    `current token block height ${
                        this.current_block_height
                    } > latest token block height ${height + 1}`,
                );
            }

            return { ret: 0 };
        }

        {
            const begin = this.current_block_height;
            const { ret } = await this._index_blocks(begin, height);
            if (ret !== 0) {
                console.error(
                    `failed to index token blocks [${begin}, ${height}])`,
                );
                return { ret };
            }
        }

        assert(
            this.current_block_height == height + 1,
            `invalid indexed block height ${this.current_block_height} != ${
                height + 1
            }`,
        );
        return { ret: 0 };
    }

    async _index_blocks(begin, end) {
        assert(begin <= end, `invalid block height range [${begin} ${end}]`);

        for (let i = begin; i <= end; ++i) {
            const { ret } = await this._index_block(i);
            if (ret !== 0) {
                console.error(`failed to index token block ${i}`);
                return { ret };
            }

            // update latest block height
            {
                const { ret } =
                    await this.state_storage.update_token_latest_block_height(
                        i,
                    );
                if (ret !== 0) {
                    console.error(
                        `failed to update token latest block height ${i}`,
                    );
                    return { ret };
                }
            }

            // update current block height immediately after synced
            this.current_block_height = i + 1;
        }

        return { ret: 0 };
    }

    async _index_block(block_height) {
        assert(
            _.isNumber(block_height),
            `invalid block_height: ${block_height}`,
        );
        assert(block_height > 0, `invalid block_height: ${block_height}`);

        const { ret, collector } = await this.loader.load_items_by_block(
            block_height,
        );
        if (ret !== 0) {
            console.error(`failed to load items by block ${block_height}`);
            return { ret };
        }

        if (collector.is_empty()) {
            console.info(
                `indexing inscriptions and transfers at block ${block_height} with empty inscriptions and transfers`,
            );

            return { ret: 0 };
        }

        console.info(
            `indexing inscriptions and transfers at block ${block_height} inscriptions count ${collector.new_inscriptions.length}, transfers count ${collector.inscription_transfers.length}`,
        );

        return await this.token_index.process_block_inscriptions(
            block_height,
            collector,
        );
    }
}

module.exports = {
    TokenIndexExecutor,
};
