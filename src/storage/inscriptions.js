const sqlite3 = require('sqlite3').verbose();
const assert = require('assert');
const path = require('path');

class InscriptionsStorage {
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
        assert(this.db == null, `InscriptionsStorage db should be null`);

        return new Promise((resolve, reject) => {
            assert(this.db == null, `InscriptionsStorage db should be null`);
            this.db = new sqlite3.Database(this.db_file_path, (err) => {
                if (err) {
                    console.error(`failed to connect to InscriptionsStorage sqlite: ${err}`);
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

                // Create inscriptions table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS inscriptions (
                    inscription_id TEXT PRIMARY KEY,
                    inscription_number INTEGER,
                    
                    content TEXT,
                    op TEXT,

                    creator TEXT,
                    owner TEXT,
                    last_block_height INTEGER,  /* last block height that this inscription transfered to new owner */

                    transfer_count INTEGER
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
        });
    }

    /**
     * 
     * @param {string} inscription_id 
     * @param {string} inscription_number 
     * @param {string} content 
     * @param {string} op 
     * @param {string} creator 
     * @param {number} block_height 
     * @returns {ret: number}
     */
    async add_new_inscription(
        inscription_id,
        inscription_number,
        content,
        op,
        creator,
        block_height,
    ) {
        assert(this.db != null, `db should not be null`);
        assert(_.isString(inscription_id), `inscription_id should be string`);
        assert(
            _.isNumber(inscription_number),
            `inscription_number should be number`,
        );
        assert(_.isString(content), `content should be string`);
        assert(_.isString(op), `op should be string`);
        assert(_.isString(creator), `creator should be string`);
        assert(_.isNumber(block_height), `block_height should be number`);

        return new Promise((resolve) => {
            const sql = `
                INSERT OR REPLACE INTO inscriptions(
                    inscription_id,
                    inscription_number,

                    content,
                    op,

                    creator,
                    owner,

                    last_block_height,

                    transfer_count
                ) VALUES(?,?,?,?,?,?,?,?)
            `;
            this.db.run(
                sql,
                [
                    inscription_id,
                    inscription_number,
                    content,
                    op,

                    creator,
                    creator, // creator is the owner at the beginning

                    block_height,
                    0,
                ],
                (err) => {
                    if (err) {
                        console.error(
                            `failed to add new inscription ${item.inscription_id} ${item.content} ${item.creator} ${item.owner}`,
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
     * @param {string} inscription_id
     * @param {string} new_owner
     * @returns {ret: number}
     */
    async transfer_owner(inscription_id, block_height, new_owner) {
        assert(this.db != null, `db should not be null`);
        assert(_.isString(inscription_id), `inscription_id should be string`);
        assert(_.isNumber(block_height), `block_height should be number`);
        assert(
            new_owner == null || _.isString(new_owner),
            `new_owner should be string or null`,
        );

        return new Promise((resolve) => {
            const sql = `
                UPDATE inscriptions
                SET owner = ?,
                    last_block_height = ?,
                    transfer_count = transfer_count + 1
                WHERE inscription_id = ? AND last_block_height < ?
            `;

            this.db.run(
                sql,
                [new_owner, block_height, inscription_id, block_height],
                function (err) {
                    if (err) {
                        console.error(
                            `failed to transfer owner ${inscription_id} ${new_owner} ${block_height} ${err}`,
                        );
                        resolve({ ret: -1 });
                    } else if (this.changes === 0) {
                        console.error(
                            `failed to transfer owner ${inscription_id} ${new_owner} ${block_height} no row updated`,
                        );
                        resolve({ ret: 0 }); // No rows were updated
                    } else {
                        console.log(
                            `transferred owner ${inscription_id} ${new_owner} ${block_height}`,
                        );
                        resolve({ ret: 0 }); // Successfully updated
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
    async get_inscription(inscription_id) {
        assert(this.db != null, `db should not be null`);
        assert(_.isString(inscription_id), `inscription_id should be string`);

        return new Promise((resolve) => {
            const sql = `
                SELECT * FROM inscriptions WHERE inscription_id = ?
            `;
            this.db.get(sql, [inscription_id], (err, row) => {
                if (err) {
                    console.error(
                        `failed to get inscription ${inscription_id}`,
                        err,
                    );
                    resolve({ ret: -1 });
                } else {
                    resolve({ ret: 0, data: row });
                }
            });
        });
    }
}

module.exports = { InscriptionsStorage };
