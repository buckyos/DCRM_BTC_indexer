const assert = require('assert');


class TokenOpsStorage {
    constructor(config) {
        assert(_.isObject(config), `config should be object`);

        this.config = config;
    }

    async init(db) {
        assert(db != null, `db should not be null`);
        assert(this.db == null, `db should be null`);
        this.db = db;

        const { ret } = await this._init_tables();
        if (ret !== 0) {
            console.error(`failed to init ops tables`);
            return { ret };
        }

        return { ret: 0 };
    }
    /**
     *
     * @returns {ret: number}
     */
    _init_tables() {
       assert(this.db != null, `db should not be null`);

        return new Promise((resolve) => {
            this.db.serialize(() => {
                let has_error = false;

                // Create user_ops table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS user_ops (
                        address TEXT,
                        inscription_id TEXT,
                        block_height INTEGER,
                        timestamp INTEGER,
                        txid TEXT,
                        op TEXT,
                        state INTEGER,
                        PRIMARY KEY (address, inscription_id, txid)
                    );`,
                    (err) => {
                        if (err) {
                            console.error(`failed to user_ops table: ${err}`);
                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(`created user_ops table`);
                    },
                );

                if (has_error) {
                    return;
                }

                resolve({ ret: 0 });
            });
        });
    }

    /**
     *
     * @param {string} address
     * @param {string} inscription_id
     * @param {number} block_height
     * @param {number} timestamp
     * @param {string} txid
     * @param {string} op
     * @param {number} state
     * @returns {ret: number}
     */
    async add_user_op(
        address,
        inscription_id,
        block_height,
        timestamp,
        txid,
        op,
        state,
    ) {
        assert(this.db != null, `db should not be null`);
        assert(typeof address === 'string', `address should be string`);
        assert(
            typeof inscription_id === 'string',
            `inscription_id should be string`,
        );
        assert(
            Number.isInteger(block_height) && block_height >= 0,
            `block_height should be non-negative integer`,
        );
        assert(Number.isInteger(timestamp), `timestamp should be integer`);
        assert(typeof txid === 'string', `txid should be string`);
        assert(typeof op === 'string', `op should be string`);
        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer`,
        );

        const sql = `
            INSERT OR REPLACE INTO user_ops (address, inscription_id, block_height, timestamp, txid, op, state)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        return new Promise((resolve) => {
            this.db.run(
                sql,
                [
                    address,
                    inscription_id,
                    block_height,
                    timestamp,
                    txid,
                    op,
                    state,
                ],
                function (err) {
                    if (err) {
                        console.error(
                            `Could not append user op ${address} ${inscription_id} ${block_height} ${op} ${state}`,
                            err,
                        );
                        resolve({ ret: -1 });
                    } else {
                        console.log(
                            `append user op ${address} ${inscription_id} ${block_height} ${op} ${state}`,
                        );
                        resolve({ ret: 0 });
                    }
                },
            );
        });
    }
}

module.exports = { TokenOpsStorage };
