const sqlite3 = require('sqlite3').verbose();
const assert = require('assert');
const path = require('path');
const { TRANSFER_DB_FILE } = require('../constants');
const { InscriptionOp } = require('../index/item');


class InscriptionTransferStorage {
    constructor(data_dir) {
        assert(
            typeof data_dir === 'string',
            `data_dir should be string: ${data_dir}`,
        );

        this.db_file_path = path.join(data_dir, TRANSFER_DB_FILE);
        this.db = null;
    }

    async init() {
        assert(this.db == null, `InscriptionTransferStorage db should be null`);

        return new Promise((resolve) => {
            assert(
                this.db == null,
                `InscriptionTransferStorage db should be null`,
            );
            this.db = new sqlite3.Database(this.db_file_path, (err) => {
                if (err) {
                    console.error(
                        `failed to connect to InscriptionTransferStorage sqlite: ${err}`,
                    );
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
                // Create inscription_transfers table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS inscription_transfers (
                        inscription_id TEXT,
                        inscription_number INTEGER,
                        block_height INTEGER,
                        timestamp INTEGER,
                        satpoint TEXT,
                        from_address TEXT,
                        to_address TEXT,
                        value INTEGER,
                        idx INTEGER DEFAULT 0,
                        op TEXT,
                        PRIMARY KEY(inscription_id, timestamp)
                      );`,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to create inscription_transfers table: ${err}`,
                            );
                            
                            resolve({ ret: -1 });
                            return;
                        }
                        console.log(`created eth inscription_transfers table`);

                        resolve({ ret: 0 });
                    },
                );
            });
        });
    }

    /**
     * 
     * @param {string} inscription_id 
     * @param {string} inscription_number 
     * @param {number} block_height 
     * @param {number} timestamp 
     * @param {string} satpoint 
     * @param {string | null} from_address 
     * @param {string} to_address 
     * @param {number} value 
     * @param {number} index 
     * @param {InscriptionOp} op 
     * @returns {Promise<{ret: number}>}
     */
    async insert_transfer(
        inscription_id,
        inscription_number,
        block_height,
        timestamp,
        satpoint,
        from_address,
        to_address,
        value,
        index, // index Indicates the number of transfers
        op, // op Indicates the operation type
    ) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof inscription_id === 'string',
            `inscription_id should be string: ${inscription_id}`,
        );
        assert(
            typeof inscription_number === 'number',
            `inscription_number should be number: ${inscription_number}`,
        );
        assert(
            typeof satpoint === 'string',
            `satpoint should be string: ${satpoint}`,
        );
        assert(
            typeof block_height === 'number',
            `block_height should be number: ${block_height}`,
        );
        assert(
            from_address == null || typeof from_address === 'string',
            `from_address should be string: ${from_address} or null`,
        );
        assert(
            typeof to_address === 'string',
            `to_address should be string: ${to_address}`,
        );
        assert(
            typeof timestamp === 'number',
            `timestamp should be number: ${timestamp}`,
        );
        assert(typeof value === 'number', `value should be number: ${value}`);
        assert(typeof index === 'number', `index should be number: ${index}`);
        assert(index >= 0, `index should be >= 0: ${index}`);
        assert(InscriptionOp.contains(op), `op should be valid: ${op}`);

        return new Promise((resolve) => {
            const sql = `
                INSERT OR REPLACE INTO inscription_transfers(
                    inscription_id, 
                    inscription_number,
                    block_height, 
                    timestamp, 
                    satpoint, 
                    from_address,
                    to_address, 
                    value,
                    idx,
                    op
                )
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(
                sql,
                [
                    inscription_id,
                    inscription_number,
                    block_height,
                    timestamp,
                    satpoint,
                    from_address,
                    to_address,
                    value,
                    index,
                    op,
                ],
                function (err) {
                    if (err) {
                        console.error(
                            `failed to insert inscription transfer: ${err}, ${inscription_id}`,
                        );
                        resolve({ ret: -1 });
                    } else {
                        if (from_address == null) {
                            console.log(
                                `inserted inscription create: ${inscription_id} ${block_height} ${timestamp} ${satpoint} ${to_address} ${op}`,
                            );
                        } else {
                            console.log(
                                `inserted inscription transfer: ${inscription_id} ${block_height} ${timestamp} ${satpoint} ${from_address} -> ${to_address} ${op}`,
                            );
                        }
                        
                        resolve({ ret: 0 });
                    }
                },
            );
        });
    }

    /**
     * 
     * @param {string} inscription_id 
     * @returns {Promise<{ret: number, data: object}>}
     */
    async get_all_transfer(inscription_id) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof inscription_id === 'string',
            `inscription_id should be string: ${inscription_id}`,
        );

        return new Promise((resolve) => {
            const sql = `
                SELECT * FROM inscription_transfers
                WHERE inscription_id = ?
                ORDER BY timestamp ASC
            `;

            this.db.all(sql, [inscription_id], (err, rows) => {
                if (err) {
                    console.error(
                        `failed to get inscription transfers: ${inscription_id} ${err}`,
                    );
                    resolve({ ret: -1 });
                } else {
                    resolve({ ret: 0, data: rows });
                }
            });
        });
    }

    /**
     *
     * @param {string} inscription_id
     * @returns {Promise<{ret: number, data: object}>}
     */
    async get_latest_transfer(inscription_id) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof inscription_id === 'string',
            `inscription_id should be string: ${inscription_id}`,
        );

        return new Promise((resolve) => {
            const sql = `
                SELECT * FROM inscription_transfers
                WHERE inscription_id = ?
                ORDER BY timestamp DESC
                LIMIT 1
            `;

            this.db.get(sql, [inscription_id], (err, row) => {
                if (err) {
                    console.error(
                        `failed to get inscription transfers: ${inscription_id} ${err}`,
                    );
                    resolve({ ret: -1 });
                } else {
                    resolve({ ret: 0, data: row });
                }
            });
        });
    }

    /**
     *
     * @param {string} inscription_id
     * @returns {Promise<{ret: number, data: object}>}
     */
    async get_first_transfer(inscription_id) {
        assert(this.db != null, `db should not be null`);
        assert(_.isString(inscription_id), `inscription_id should be string`);
        
        return new Promise((resolve) => {
            const sql = `
                SELECT * FROM inscription_transfers
                WHERE inscription_id = ?
                ORDER BY timestamp ASC
                LIMIT 1
            `;

            this.db.get(sql, [inscription_id], (err, row) => {
                if (err) {
                    console.error(
                        `failed to get inscription first transfer: ${inscription_id} ${err}`,
                    );
                    resolve({ ret: -1 });
                } else {
                    resolve({ ret: 0, data: row });
                }
            });
        });
    }

    /**
     *
     * @returns {Promise<{ret: number, data: Array<object>}>}
     */
    get_all_inscriptions_with_last_transfer() {
        assert(this.db != null, `db should not be null`);

        return new Promise((resolve) => {
            const sql = `
                SELECT it1.* FROM inscription_transfers it1
                JOIN (
                SELECT inscription_id, MAX(timestamp) AS max_timestamp
                FROM inscription_transfers
                GROUP BY inscription_id
                ) it2
                ON it1.inscription_id = it2.inscription_id AND it1.timestamp = it2.max_timestamp
                WHERE ((it1.op = 'transfer' OR it1.op = 'resonance') AND it1.idx = 0) OR it1.op = 'inscribe'
            `;

            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error(
                        `failed to get all inscription with last transfer: ${err}`,
                    );
                    resolve({ ret: -1 });
                } else {
                    resolve({ ret: 0, data: rows });
                }
            });
        });
    }
}

module.exports = { InscriptionTransferStorage };
