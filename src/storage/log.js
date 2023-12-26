const sqlite3 = require('sqlite3').verbose();
const assert = require('assert');
const path = require('path');

class InscriptionLogStorage {
    constructor(data_dir) {
        assert(
            typeof data_dir === 'string',
            `data_dir should be string: ${data_dir}`,
        );

        this.db_file_path = path.join(data_dir, 'inscriptions.sqlite');
        this.db = null;
    }

    /**
     *
     * @returns {ret: number}
     */
    async init() {
        assert(this.db == null, `db should be null`);

        return new Promise((resolve, reject) => {
            assert(this.db == null, `db should be null`);
            this.db = new sqlite3.Database(this.db_file_path, (err) => {
                if (err) {
                    console.error(`failed to connect to sqlite: ${err}`);
                    resolve({ ret: -1 });
                    return;
                }

                console.log(`Connected to ${this.db_file_path}`);
                this.init_tables().then(({ ret }) => {
                    resolve({ ret });
                });
            });
        });
    }

    async init_tables() {
        assert(this.db != null, `db should not be null`);

        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                let has_error = false;

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
                            has_error = true;
                            resolve({ ret: -1 });
                            return;
                        }
                        console.log(`created state table`);
                    },
                );

                if (has_error) {
                    return;
                }

                // Create inscriptions table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS inscriptions (
                    block_height INTEGER,
                    inscription_index INTEGER,
                    txid TEXT,
                    inscription_id TEXT PRIMARY KEY,
                    address TEXT,
                    output_address TEXT,
                    content TEXT
                )`,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to create inscriptions table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(`created inscriptions table`);
                    },
                );

                if (has_error) {
                    return;
                }

                // Create index on inscriptions table
                this.db.run(
                    `CREATE INDEX IF NOT EXISTS idx_inscription ON inscriptions (inscription_id)`,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to create index on inscriptions table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(`created index on inscriptions table`);

                        resolve({ ret: 0 });
                    },
                );
            });

            // resolve({ ret: 0 });
        });
    }

    /**
     *
     * @returns {ret: number, height: number}
     */
    async get_latest_block_height() {
        assert(this.db != null, `db should not be null`);

        return new Promise((resolve, reject) => {
            this.db.get(
                "SELECT value FROM state WHERE name = 'latest_block_height'",
                (err, row) => {
                    if (err) {
                        console.error('failed to get latest block height', err);
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0, height: row ? row.value : 0 });
                    }
                },
            );
        });
    }

    async update_latest_block_height(block_height) {
        assert(this.db != null, `db should not be null`);
        assert(
            Number.isInteger(block_height) && block_height >= 0,
            'block_height must be a non-negative integer',
        );

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO state (name, value) VALUES ('latest_block_height', ?)`,
                block_height,
                (err) => {
                    if (err) {
                        console.error(
                            'failed to update latest block height',
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

    async log_inscription(
        block_height,
        inscription_index,
        txid,
        inscription_id,
        address,
        output_address,
        content,
    ) {
        assert(
            Number.isInteger(block_height) && block_height >= 0,
            `block_height should be non-negative integer`,
        );
        assert(
            Number.isInteger(inscription_index) && inscription_index >= 0,
            `inscription_index should be non-negative integer`,
        );
        assert(typeof txid === 'string', `txid should be string`);
        assert(
            typeof inscription_id === 'string',
            `inscription_id should be string`,
        );
        assert(typeof address === 'string', `address should be string`);
        assert(
            typeof output_address === 'string',
            `output_address should be string`,
        );
        assert(typeof content === 'object', `content should be object`);

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO inscriptions (block_height, inscription_index, txid, inscription_id, address, output_address, content) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    block_height,
                    inscription_index,
                    txid,
                    inscription_id,
                    address,
                    output_address,
                    JSON.stringify(content),
                ],
                (err) => {
                    if (err) {
                        console.error('failed to log inscriptions', err);
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0 });
                    }
                },
            );
        });
    }
}

module.exports = { InscriptionLogStorage };
