const sqlite3 = require('sqlite3').verbose();
const assert = require('assert');
const path = require('path');
const {STATE_DB_FILE} = require('../constants');

// db to store global state
class StateStorage {
    constructor(data_dir) {
        assert(
            typeof data_dir === 'string',
            `data_dir should be string: ${data_dir}`,
        );

        this.db_file_path = path.join(data_dir, STATE_DB_FILE);
        this.db = null;
    }

    /**
     *
     * @returns {ret: number}
     */
    async init() {
        assert(this.db == null, `StateStorage db should be null`);

        return new Promise((resolve) => {
            assert(this.db == null, `StateStorage db should be null`);
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
    async get_btc_latest_block_height() {
        assert(this.db != null, `db should not be null`);

        return new Promise((resolve) => {
            this.db.get(
                "SELECT value FROM state WHERE name = 'btc_latest_block_height'",
                (err, row) => {
                    if (err) {
                        console.error('failed to get btc latest block height', err);
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0, height: row ? row.value : 0 });
                    }
                },
            );
        });
    }

    async update_btc_latest_block_height(block_height) {
        assert(this.db != null, `db should not be null`);
        assert(
            Number.isInteger(block_height) && block_height >= 0,
            'block_height must be a non-negative integer',
        );

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR REPLACE INTO state (name, value) VALUES ('btc_latest_block_height', ?)`,
                block_height,
                (err) => {
                    if (err) {
                        console.error(
                            'failed to update btc latest block height',
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

    /**
     *
     * @returns {ret: number, height: number}
     */
    async get_eth_latest_block_height() {
        assert(this.db != null, `db should not be null`);

        return new Promise((resolve) => {
            this.db.get(
                "SELECT value FROM state WHERE name = 'eth_latest_block_height'",
                (err, row) => {
                    if (err) {
                        console.error('failed to get eth latest block height', err);
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0, height: row ? row.value : 0 });
                    }
                },
            );
        });
    }

    async update_eth_latest_block_height(block_height) {
        assert(this.db != null, `db should not be null`);
        assert(
            Number.isInteger(block_height) && block_height >= 0,
            'block_height must be a non-negative integer',
        );

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR REPLACE INTO state (name, value) VALUES ('eth_latest_block_height', ?)`,
                block_height,
                (err) => {
                    if (err) {
                        console.error(
                            'failed to update eth latest block height',
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

module.exports = { StateStorage };
