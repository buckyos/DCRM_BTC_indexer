const sqlite3 = require('sqlite3').verbose();
const assert = require('assert');
const path = require('path');

class ETHIndexStorage {
    constructor(data_dir) {
        assert(
            typeof data_dir === 'string',
            `data_dir should be string: ${data_dir}`,
        );

        this.db_file_path = path.join(data_dir, 'eth_index.sqlite');
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

                // Create points table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS points (
                        block_height INTEGER,
                        hash TEXT,
                        point INTEGER,
                        PRIMARY KEY (block_height, hash)
                        
                )`,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to create points table: ${err}`,
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

                // Create blocks table
                this.db.run(
                    `CREATE TABLE blocks (
                        block_height INTEGER PRIMARY KEY,
                        timestamp INTEGER,
                    )`,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to create blocks table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(`created blocks table`);

                        resolve({ ret: 0 });
                    },
                );
            });
        });
    }

    // get point for hash before block_height(include block_height)
    async get_history_point(block_height, hash) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof block_height === 'number',
            `block_height should be number`,
        );
        assert(typeof hash === 'string', `hash should be string`);

        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT point FROM points WHERE block_height <= ? AND hash = ? ORDER BY block_height DESC LIMIT 1`,
                [block_height, hash],
                (err, row) => {
                    if (err) {
                        console.error(
                            `failed to get history point: ${block_height} ${hash} ${err}`,
                        );
                        resolve({ ret: -1 });
                        return;
                    }

                    resolve({ ret: 0, point: row ? row.point : 0 });
                },
            );
        });
    }

    async update_point(block_height, hash, amount) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof block_height === 'number',
            `block_height should be number`,
        );
        assert(block_height > 0, `block_height should be greater than 0`);
        assert(typeof hash === 'string', `hash should be string`);
        assert(typeof amount === 'number', `amount should be number`);

        const { ret, point } = await this.get_history_point(
            block_height - 1,
            hash,
        );
        if (ret !== 0) {
            console.error(
                `failed to get history point: ${block_height} ${hash}`,
            );
            return { ret };
        }

        const new_point = point + amount;

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO points (block_height, hash, point) VALUES (?, ?, ?, ?)`,
                [block_height, hash, new_point],
                (err) => {
                    if (err) {
                        console.error(
                            `failed to insert hash point: ${block_height} ${hash} ${new_point} ${err}`,
                        );
                        resolve({ ret: -1 });
                        return;
                    }

                    console.log(
                        `update hash point: ${block_height} ${hash} ${point}  -> ${new_point}`,
                    );
                    resolve({ ret: 0 });
                },
            );
        });
    }

    /**
     * @comment insert block_height and timestamp
     * @param {number} block_height 
     * @param {number} timestamp 
     * @returns {ret: number}
     */
    async insert_block(block_height, timestamp) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof block_height === 'number',
            `block_height should be number`,
        );
        assert(block_height > 0, `block_height should be greater than 0`);
        assert(typeof timestamp === 'number', `timestamp should be number`);

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR REPLACE INTO blocks (block_height, timestamp) VALUES (?, ?)`,
                [block_height, timestamp],
                (err) => {
                    if (err) {
                        console.error(
                            `failed to insert block: ${block_height} ${timestamp} ${err}`,
                        );
                        resolve({ ret: -1 });
                        return;
                    }

                    console.log(`insert eth block: ${block_height} ${timestamp}`);
                    resolve({ ret: 0 });
                },
            );
        });
    }

    /**
     * @comment return block_height where timestamp <= target_timestamp && block_height + 1 timestamp > target_timestamp
     * @param {number} target_timestamp 
     * @returns {ret: number, block_height: number | null}
     */
    async query_block_with_timestamp(target_timestamp) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof target_timestamp === 'number',
            `target_timestamp should be number`,
        );

        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT b1.block_height FROM blocks b1, blocks b2
                WHERE b1.timestamp <= ? AND b2.timestamp > ? AND b2.block_height = b1.block_height + 1
                ORDER BY b1.timestamp DESC
                LIMIT 1
            `,
                [target_timestamp, target_timestamp],
                (err, row) => {
                    if (err) {
                        console.error(
                            `failed to query block with timestamp: ${target_timestamp} ${err}`,
                        );
                        resolve({ ret: -1 });
                    }

                    resolve({
                        ret: 0,
                        block_height: row ? row.block_height : null,
                    });
                },
            );
        });
    }
}

module.exports = { ETHIndexStorage };
