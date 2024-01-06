const sqlite3 = require('sqlite3').verbose();
const assert = require('assert');
const path = require('path');
const {TOKEN_STATE_DB_FILE} = require('../constants');

// db to store global state
class TokenStateStorage {
    constructor(data_dir) {
        assert(
            typeof data_dir === 'string',
            `data_dir should be string: ${data_dir}`,
        );

        this.db_file_path = path.join(data_dir, TOKEN_STATE_DB_FILE);
        this.db = null;
    }

    /**
     *
     * @returns {ret: number}
     */
    async init() {
        assert(this.db == null, `token state storage db should be null`);

        return new Promise((resolve) => {
            assert(this.db == null, `token state storage db should be null`);
            this.db = new sqlite3.Database(this.db_file_path, (err) => {
                if (err) {
                    console.error(`failed to connect to sqlite: ${err}`);
                    resolve({ ret: -1 });
                    return;
                }

                console.log(`Connected to ${this.db_file_path}`);
                this._init_tables().then(({ ret }) => {
                    resolve({ ret });
                });
            });
        });
    }

    async _init_tables() {
        assert(this.db != null, `db should not be null`);

        return new Promise((resolve) => {
            this.db.serialize(() => {

                // Create state table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS state (
                    name TEXT PRIMARY KEY,
                    value INTEGER
                )`,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to create state table: ${err}`,
                            );
    
                            resolve({ ret: -1 });
                            return;
                        }

                        console.log(`created state table`);
                        resolve({ ret: 0 });
                    },
                );
            });
        });
    }

    /**
     *
     * @returns {ret: number, height: number}
     */
    async get_token_latest_block_height() {
        assert(this.db != null, `db should not be null`);

        return new Promise((resolve) => {
            this.db.get(
                "SELECT value FROM state WHERE name = 'token_latest_block_height'",
                (err, row) => {
                    if (err) {
                        console.error('failed to get token latest block height', err);
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0, height: row ? row.value : 0 });
                    }
                },
            );
        });
    }

    /**
     * @comment update token latest block height only block_height = current_block_height + 1 or current_block_height = 0
     * @param {number} block_height 
     * @returns {ret: number}
     */
    async update_token_latest_block_height(block_height) {
        // update token latest block height only block_height = current_block_height + 1 or current_block_height = 0
        assert(this.db != null, `db should not be null`);
        assert(
            Number.isInteger(block_height) && block_height >= 0,
            'block_height must be a non-negative integer',
        );

        const { ret: get_ret, height } = await this.get_token_latest_block_height();
        if (get_ret !== 0) {
            console.error(`failed to get token latest block height`);
            return { ret: get_ret };
        }

        if (height !== (block_height - 1) && height !== 0) {
            console.error(`invalid token block height ${height} + 1 != ${block_height}`);
            return { ret: -1 };
        }
        
        return await this._update_token_latest_block_height(block_height);
    }

    /**
     * @comment update token latest block height anyway
     * @param {number} block_height 
     * @returns {ret: number}
     */
    async _update_token_latest_block_height(block_height) {
        assert(this.db != null, `db should not be null`);
        assert(
            Number.isInteger(block_height) && block_height >= 0,
            'block_height must be a non-negative integer',
        );

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR REPLACE INTO state (name, value) VALUES ('token_latest_block_height', ?)`,
                block_height,
                (err) => {
                    if (err) {
                        console.error(
                            'failed to update token latest block height',
                            err,
                        );
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0 });
                    }
                },
            );
        });
    }
}

module.exports = { TokenStateStorage };
