const assert = require('assert');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const { Util } = require('./util');
const { ETHIndex } = require('./eth/index');

const ChainType = {
    BTC: 'btc',
    ETH: 'eth',
    Both: 'both',
};
class ResetManager {
    constructor(config) {
        assert(_.isObject(config), `config should be an object: ${config}`);
        this.config = config;
    }

    async reset(mode, chain_type = ChainType.Both) {
        assert(_.isString(mode), `mode should be string, but ${mode}`);
        assert(
            chain_type === ChainType.BTC ||
                chain_type === ChainType.ETH ||
                chain_type === ChainType.Both,
            `invalid chain type: ${chain_type}`,
        );

        console.log(`will reset mode: ${mode}, chain type: ${chain_type}`);

        const now = Date.now();
        if (mode === 'sync' || mode === 'both') {
            if (chain_type === ChainType.Both) {
                this._reset_sync(now);
            } else if (chain_type === ChainType.ETH) {
                await this._reset_sync_eth_only(now);
            } else if (chain_type === ChainType.BTC) {
                console.warn('reset btc only not supported yet');
                // do nothing
            }
        }

        if (mode === 'index' || mode === 'both') {
            this._reset_index(now);
        }
    }

    _get_del_dir(dir, now) {
        assert(_.isString(dir), `dir should be string, but ${dir}`);
        assert(_.isNumber(now), `now should be number, but ${now}`);

        const del_dir = path.join(
            dir,
            `del_${moment(now).format('YYYY_MM_DD_HH_mm_ss')}`,
        );
        fs.mkdirSync(del_dir, { recursive: true });

        return del_dir;
    }

    _reset_sync(now) {
        const {
            SYNC_STATE_DB_FILE,
            ETH_INDEX_DB_FILE,
            INSCRIPTION_DB_FILE,
            TRANSFER_DB_FILE,
        } = require('./constants');

        // delete all the db files above

        const { ret: get_dir_ret, dir } = Util.get_data_dir(this.config);
        if (get_dir_ret !== 0) {
            throw new Error(`failed to get data dir`);
        }

        // create tmp dir for delete with current time
        const tmp_dir = this._get_del_dir(dir, now);

        const sync_state_db_file = path.join(dir, SYNC_STATE_DB_FILE);
        if (fs.existsSync(sync_state_db_file)) {
            const target_file = path.join(tmp_dir, SYNC_STATE_DB_FILE);
            console.warn(
                `remove sync state db: ${sync_state_db_file} -> ${target_file}`,
            );
            fs.renameSync(
                sync_state_db_file,
                path.join(tmp_dir, SYNC_STATE_DB_FILE),
            );
            // fs.unlinkSync(sync_state_db_file);
        }

        const eth_index_db_file = path.join(dir, ETH_INDEX_DB_FILE);
        if (fs.existsSync(eth_index_db_file)) {
            const target_file = path.join(tmp_dir, ETH_INDEX_DB_FILE);
            console.warn(
                `remove eth index db: ${eth_index_db_file} -> ${target_file}`,
            );
            fs.renameSync(eth_index_db_file, target_file);
            // fs.unlinkSync(eth_index_db_file);
        }

        const inscription_db_file = path.join(dir, INSCRIPTION_DB_FILE);
        if (fs.existsSync(inscription_db_file)) {
            const target_file = path.join(tmp_dir, INSCRIPTION_DB_FILE);
            console.warn(
                `remove inscription db: ${inscription_db_file} -> ${target_file}`,
            );
            fs.renameSync(inscription_db_file, target_file);
            // fs.unlinkSync(inscription_db_file);
        }

        const transfer_db_file = path.join(dir, TRANSFER_DB_FILE);
        if (fs.existsSync(transfer_db_file)) {
            const target_file = path.join(tmp_dir, TRANSFER_DB_FILE);
            console.warn(
                `remove transfer db: ${transfer_db_file} -> ${target_file}`,
            );
            fs.renameSync(transfer_db_file, target_file);
            // fs.unlinkSync(transfer_db_file);
        }
    }

    async _reset_sync_eth_only(now) {
        const {
            SYNC_STATE_DB_FILE,
            ETH_INDEX_DB_FILE,
        } = require('./constants');

        const { ret: get_dir_ret, dir } = Util.get_data_dir(this.config);
        if (get_dir_ret !== 0) {
            throw new Error(`failed to get data dir`);
        }

        const tmp_dir = this._get_del_dir(dir, now);

        const sync_state_db_file = path.join(dir, SYNC_STATE_DB_FILE);
        if (fs.existsSync(sync_state_db_file)) {
            const eth_index = new ETHIndex(this.config);

            // first init the eth index db
            const { ret: init_ret } = await eth_index.init();
            if (init_ret !== 0) {
                throw new Error(`failed to init eth index`);
            }

            const { ret, height } = await eth_index.get_latest_block_number();
            if (ret !== 0) {
                throw new Error(`failed to get latest block number`);
            }

            // reset the sync state db
            console.warn(`will reset sync state: ${height} -> 0`);
            const { ret: reset_ret } =
                await eth_index.state_storage.reset_eth_latest_block_height();
            if (reset_ret !== 0) {
                throw new Error(`failed to reset eth latest block height`);
            }
        }

        const eth_index_db_file = path.join(dir, ETH_INDEX_DB_FILE);
        if (fs.existsSync(eth_index_db_file)) {
            const target_file = path.join(tmp_dir, ETH_INDEX_DB_FILE);
            console.warn(
                `remove eth index db: ${eth_index_db_file} -> ${target_file}`,
            );
            fs.renameSync(eth_index_db_file, target_file);
            // fs.unlinkSync(eth_index_db_file);
        }
    }

    _reset_index(now) {
        const {
            INDEX_STATE_DB_FILE,
            TOKEN_INDEX_DB_FILE,
        } = require('./constants');

        const { ret: get_dir_ret, dir } = Util.get_data_dir(this.config);
        if (get_dir_ret !== 0) {
            throw new Error(`failed to get data dir`);
        }

        const tmp_dir = this._get_del_dir(dir, now);

        const index_state_db_file = path.join(dir, INDEX_STATE_DB_FILE);
        if (fs.existsSync(index_state_db_file)) {
            const target_file = path.join(tmp_dir, INDEX_STATE_DB_FILE);
            console.warn(
                `remove index state db: ${index_state_db_file} -> ${target_file}`,
            );
            fs.renameSync(index_state_db_file, target_file);
            // fs.unlinkSync(index_state_db_file);
        }

        const token_index_db_file = path.join(dir, TOKEN_INDEX_DB_FILE);
        if (fs.existsSync(token_index_db_file)) {
            const target_file = path.join(tmp_dir, TOKEN_INDEX_DB_FILE);
            console.warn(
                `remove token index db: ${token_index_db_file} -> ${target_file}`,
            );
            fs.renameSync(token_index_db_file, target_file);
            // fs.unlinkSync(token_index_db_file);
        }
    }
}

module.exports = {
    ResetManager,
    ChainType,
};
