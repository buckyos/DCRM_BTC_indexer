const sqlite3 = require('sqlite3').verbose();
const assert = require('assert');
const path = require('path');
const { ETH_INDEX_DB_FILE } = require('../constants');
const { Util } = require('../util');

class ETHIndexStorage {
    constructor(data_dir) {
        assert(
            typeof data_dir === 'string',
            `data_dir should be string: ${data_dir}`,
        );

        this.db_file_path = path.join(data_dir, ETH_INDEX_DB_FILE);
        this.db = null;
    }

    /**
     *
     * @returns {ret: number}
     */
    async init() {
        assert(this.db == null, `ETHIndexStorage db should be null`);

        return new Promise((resolve) => {
            assert(this.db == null, `ETHIndexStorage db should be null`);
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

        return new Promise((resolve) => {
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
                                `failed to create eth points table: ${err}`,
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
                    `CREATE TABLE IF NOT EXISTS blocks (
                        block_height INTEGER PRIMARY KEY,
                        timestamp INTEGER
                    )`,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to create eth blocks table: ${err}`,
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

    /**
     *
     * @param {number} block_height
     * @returns {ret: number, timestamp: number}
     */
    async get_timestamp(block_height) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof block_height === 'number',
            `block_height should be number`,
        );
        assert(block_height >= 0, `block_height should be greater than 0`);

        return new Promise((resolve) => {
            this.db.get(
                `SELECT timestamp FROM blocks WHERE block_height = ?`,
                block_height,
                (err, row) => {
                    if (err) {
                        console.error(
                            `failed to get timestamp: ${block_height} ${err}`,
                        );
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0, timestamp: row ? row.timestamp : 0 });
                    }
                },
            );
        });
    }

    /**
     * get point for hash before block_height(include block_height)
     * @param {number} block_height
     * @param {string} hash
     * @returns {ret: number, point: number}
     */
    async get_history_point(block_height, hash) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof block_height === 'number',
            `block_height should be number`,
        );
        assert(Util.is_valid_and_strict_hex_mixhash(hash), `hash should be hex string: ${hash}`);

        return new Promise((resolve) => {
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

    /**
     *
     * @param {number} block_height
     * @param {string} hash
     * @param {number} amount
     * @returns
     */
    async update_point(block_height, hash, amount) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof block_height === 'number',
            `block_height should be number: ${block_height}`,
        );
        assert(block_height > 0, `block_height should be greater than 0`);
        assert(Util.is_valid_and_strict_hex_mixhash(hash), `hash should be hex string: ${hash}`);
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

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR REPLACE INTO points (block_height, hash, point) VALUES (?, ?, ?)`,
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

                    console.debug(
                        `insert eth block: ${block_height} ${timestamp}`,
                    );
                    resolve({ ret: 0 });
                },
            );
        });
    }

    /**
     * @comment query first block with lowest timestamp
     * @returns {ret: number, block_height: number | null, timestamp: number | null}
     */
    async query_first_block() {
        assert(this.db != null, `db should not be null`);

        return new Promise((resolve) => {
            this.db.get(
                `SELECT * FROM blocks ORDER BY timestamp ASC LIMIT 1`,
                (err, row) => {
                    if (err) {
                        console.error(`failed to query first block: ${err}`);
                        resolve({ ret: -1 });
                        return;
                    }

                    if (row == null) {
                        resolve({
                            ret: 0,
                            block_height: null,
                            timestamp: null,
                        });
                        return;
                    } else {
                        resolve({
                            ret: 0,
                            block_height: row.block_height,
                            timestamp: row.timestamp,
                        });
                    }
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

        return new Promise((resolve) => {
            this.db.get(
                `
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
