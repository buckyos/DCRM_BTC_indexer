const sqlite3 = require('sqlite3').verbose();
const assert = require('assert');
const path = require('path');

class TokenIndexStorage {
    constructor(data_dir) {
        assert(
            typeof data_dir === 'string',
            `data_dir should be string: ${data_dir}`,
        );

        this.db_file_path = path.join(data_dir, 'index.sqlite');
        this.db = null;
        this.during_transaction = false;
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

    init_tables() {
        assert(this.db != null, `db should not be null`);

        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                let has_error = false;

                // Create mint_records table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS mint_records (
                        inscription_id TEXT PRIMARY KEY,
                        block_height INTEGER,
                        timestamp INTEGER,
                        address TEXT,
                        amount INTEGER,
                        lucky TEXT DEFAULT NULL
                    )`,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to create mint_records table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                            return;
                        }
                        console.log(`created mint_records table`);
                    },
                );

                if (has_error) {
                    return;
                }

                // Create inscribe_records table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS inscribe_records (
                        inscription_id TEXT PRIMARY KEY,
                        block_height INTEGER,
                        address TEXT,
                        timestamp INTEGER,
                        hash TEXT,
                        amount TEXT,
                        text TEXT,
                        price INTEGER,
                        state INTEGER DEFAULT 0
                    )`,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to create inscribe_records table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(`created inscribe_records table`);
                    },
                );

                if (has_error) {
                    return;
                }

                // Create chant_records table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS chant_records (
                        inscription_id TEXT PRIMARY KEY,
                        block_height INTEGER,
                        hash TEXT,
                        state INTEGER DEFAULT 0
                    )`,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to chant_records table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(`created chant_records table`);
                    },
                );

                if (has_error) {
                    return;
                }

                // Create transfer_records table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS transfer_records (
                        inscription_id TEXT PRIMARY KEY,
                        block_height INTEGER,
                        from_address TEXT,
                        to_address TEXT,
                        state INTEGER DEFAULT 0
                    )`,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to transfer_records table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(`created transfer_records table`);
                    },
                );

                if (has_error) {
                    return;
                }

                // Create set_price_records table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS set_price_records (
                        inscription_id TEXT PRIMARY KEY,
                        block_height INTEGER,
                        address TEXT,
                        price INTEGER
                    )`,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to set_price_records table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(`created set_price_records table`);
                    },
                );

                if (has_error) {
                    return;
                }

                // Create resonance_records table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS resonance_records (
                        inscription_id TEXT PRIMARY KEY,
                        block_height INTEGER,
                        amount INTEGER,
                        state INTEGER DEFAULT 0
                    )`,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to resonance_records table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(`created resonance_records table`);
                    },
                );

                if (has_error) {
                    return;
                }

                // Create balance table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS balance (
                        address TEXT PRIMARY KEY,
                        amount INTEGER
                    );`,
                    (err) => {
                        if (err) {
                            console.error(`failed to balance table: ${err}`);
                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(`created balance table`);
                    },
                );

                if (has_error) {
                    return;
                }

                // Create inscribe_data table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS inscribe_data (
                        hash TEXT PRIMARY KEY,
                        address TEXT,
                        block_height INTEGER,
                        timestamp INTEGER,
                        text TEXT,
                        price TEXT,
                        resonance_count INTEGER
                    );`,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to inscribe_data table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(`created inscribe_data table`);
                    },
                );

                if (has_error) {
                    return;
                }

                // Create user_ops table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS user_ops (
                        address TEXT,
                        inscription_id TEXT,
                        block_height INTEGER,
                        op TEXT,
                        PRIMARY KEY (address, inscription_id)
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

                // Create data_resonance table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS data_resonance (
                        hash TEXT,
                        inscription_id TEXT,
                        address TEXT,
                        block_height INTEGER,
                        amount INTEGER,
                        PRIMARY KEY (hash, inscription_id)
                    );`,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to data_resonance table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(`created data_resonance table`);
                    },
                );

                if (has_error) {
                    return;
                }

                // Create data_chant table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS data_chant (
                        hash TEXT,
                        inscription_id TEXT,
                        address TEXT,
                        block_height INTEGER,
                        amount INTEGER,
                        PRIMARY KEY (hash, inscription_id)
                    )`,
                    (err) => {
                        if (err) {
                            console.error(`failed to data_chant table: ${err}`);
                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(`created data_chant table`);

                        resolve({ ret: 0 });
                    },
                );
            });
        });
    }

    /**
     * 
     * @returns {ret: number}
     */
    async begin_transaction() {
        assert(this.db != null, `db should not be null`);
        assert(!this.during_transaction, `should not be during transaction`);

        return new Promise((resolve, reject) => {
            this.db.run('BEGIN TRANSACTION', (err) => {
                if (err) {
                    console.error('Could not begin transaction', err);
                    resolve({ ret: -1 });
                } else {
                    assert(
                        !this.during_transaction,
                        `should not be during transaction`,
                    );
                    this.during_transaction = true;
                    resolve({ ret: 0 });
                }
            });
        });
    }

    /**
     * 
     * @param {boolean} is_success
     * @returns {ret: number}
     */
    async end_transaction(is_success) {
        assert(this.db != null, `db should not be null`);
        assert(this.during_transaction, `should be during transaction`);

        const sql = is_success ? 'COMMIT' : 'ROLLBACK';

        return new Promise((resolve, reject) => {
            this.db.run(sql, (err) => {
                if (err) {
                    console.error(
                        `Could not ${
                            is_success ? 'commit' : 'rollback'
                        } transaction`,
                        err,
                    );
                    resolve({ ret: -1 });
                } else {
                    assert(
                        this.during_transaction,
                        `should be during transaction`,
                    );
                    this.during_transaction = false;

                    resolve({ ret: 0 });
                }
            });
        });
    }

    async add_mint_record(
        inscription_id,
        block_height,
        timestamp,
        address,
        amount,
        lucky,
    ) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof inscription_id === 'string',
            `inscription_id should be string`,
        );
        assert(
            Number.isInteger(block_height) && block_height >= 0,
            `block_height should be non-negative integer`,
        );
        assert(Number.isInteger(timestamp), `timestamp should be integer`);
        assert(typeof address === 'string', `address should be string`);
        assert(
            Number.isInteger(amount) && amount >= 0,
            `amount should be non-negative integer`,
        );
        assert(typeof lucky === 'string', `lucky should be string`);

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO mint_records (inscription_id, block_height, timestamp, address, amount, lucky) VALUES (?, ?, ?, ?, ?)`,
                [inscription_id, block_height, timestamp, address, amount, lucky],
                (err) => {
                    if (err) {
                        console.error('failed to add mint record', err);
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
     * @param {number} block_height 
     * @param {string} address 
     * @param {number} timestamp 
     * @param {string} hash 
     * @param {number} amount 
     * @param {string} text 
     * @param {number} price 
     * @param {number} state 
     * @returns 
     */
    async add_inscribe_record(
        inscription_id,
        block_height,
        address,
        timestamp,
        hash,
        amount,
        text,
        price,
        state,
    ) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof inscription_id === 'string',
            `inscription_id should be string`,
        );
        assert(
            Number.isInteger(block_height) && block_height >= 0,
            `block_height should be non-negative integer`,
        );
        assert(typeof address === 'string', `address should be string`);
        assert(Number.isInteger(timestamp), `timestamp should be integer`);
        assert(typeof hash === 'string', `hash should be string`);
        assert(typeof amount === 'string', `amount should be string`);
        assert(typeof text === 'string', `text should be string`);
        assert(
            Number.isInteger(price) && price >= 0,
            `price should be non-negative integer`,
        );
        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer`,
        );

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO inscribe_records (inscription_id, block_height, address, timestamp, hash, amount, text, price, state) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    inscription_id,
                    block_height,
                    address,
                    timestamp,
                    hash,
                    amount,
                    text,
                    price,
                    state,
                ],
                (err) => {
                    if (err) {
                        console.error('failed to add inscribe record', err);
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0 });
                    }
                },
            );
        });
    }

    async add_chant_record(inscription_id, block_height, hash, state) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof inscription_id === 'string',
            `inscription_id should be string`,
        );
        assert(
            Number.isInteger(block_height) && block_height >= 0,
            `block_height should be non-negative integer`,
        );
        assert(typeof hash === 'string', `hash should be string`);
        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer`,
        );

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO chant_records (inscription_id, block_height, hash, state) VALUES (?, ?, ?, ?)`,
                [inscription_id, block_height, hash, state],
                (err) => {
                    if (err) {
                        console.error('failed to add chant record', err);
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0 });
                    }
                },
            );
        });
    }

    async add_transfer_record(
        inscription_id,
        block_height,
        from_address,
        to_address,
        state,
    ) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof inscription_id === 'string',
            `inscription_id should be string`,
        );
        assert(
            Number.isInteger(block_height) && block_height >= 0,
            `block_height should be non-negative integer`,
        );
        assert(
            typeof from_address === 'string',
            `from_address should be string`,
        );
        assert(typeof to_address === 'string', `to_address should be string`);
        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer`,
        );

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO transfer_records (inscription_id, block_height, from_address, to_address, state) VALUES (?, ?, ?, ?, ?)`,
                [inscription_id, block_height, from_address, to_address, state],
                (err) => {
                    if (err) {
                        console.error('failed to add transfer record', err);
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0 });
                    }
                },
            );
        });
    }

    async add_set_price_record(inscription_id, block_height, address, price) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof inscription_id === 'string',
            `inscription_id should be string`,
        );
        assert(
            Number.isInteger(block_height) && block_height >= 0,
            `block_height should be non-negative integer`,
        );
        assert(typeof address === 'string', `address should be string`);
        assert(
            Number.isInteger(price) && price >= 0,
            `price should be non-negative integer`,
        );

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO set_price_records (inscription_id, block_height, address, price) VALUES (?, ?, ?, ?)`,
                [inscription_id, block_height, address, price],
                (err) => {
                    if (err) {
                        console.error('failed to add set price record', err);
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0 });
                    }
                },
            );
        });
    }

    async add_resonance_record(inscription_id, block_height, amount, state) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof inscription_id === 'string',
            `inscription_id should be string`,
        );
        assert(
            Number.isInteger(block_height) && block_height >= 0,
            `block_height should be non-negative integer`,
        );
        assert(
            Number.isInteger(amount) && amount >= 0,
            `amount should be non-negative integer`,
        );
        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer`,
        );

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO resonance_records (inscription_id, block_height, amount, state) VALUES (?, ?, ?, ?)`,
                [inscription_id, block_height, amount, state],
                (err) => {
                    if (err) {
                        console.error('failed to add resonance record', err);
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0 });
                    }
                },
            );
        });
    }

    async add_balance(address, amount) {
        assert(this.db != null, `db should not be null`);
        assert(typeof address === 'string', `address should be string`);
        assert(
            Number.isInteger(amount) && amount >= 0,
            `amount should be non-negative integer`,
        );

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO balance (address, amount) VALUES (?, ?)`,
                [address, amount],
                (err) => {
                    if (err) {
                        console.error('failed to add balance', err);
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0 });
                    }
                },
            );
        });
    }

    // balance table methods

    async update_balance(address, amount) {
        assert(this.db != null, `db should not be null`);
        assert(typeof address === 'string', `address should be string`);
        assert(Number.isInteger(amount), `amount should be integer`);

        const sql = `
            INSERT INTO balance (address, amount)
            VALUES (?, ?)
            ON CONFLICT(address) DO UPDATE SET amount = amount + excluded.amount
        `;

        return new Promise((resolve, reject) => {
            this.db.run(sql, [address, amount], (err) => {
                if (err) {
                    console.error('Could not update balance', err);
                    resolve({ ret: -1 });
                } else {
                    resolve({ ret: 0 });
                }
            });
        });
    }

    /**
     * 
     * @param {string} address 
     * @returns {ret: number, amount: number}
     */
    async get_balance(address) {
        const sql = `
            SELECT amount FROM balance WHERE address = ?
        `;

        return new Promise((resolve, reject) => {
            this.db.get(sql, [address], (err, row) => {
                if (err) {
                    console.error('Could not get balance', err);
                    resolve({ ret: -1 });
                } else {
                    resolve({ ret: 0, amount: row ? row.amount : 0 });
                }
            });
        });
    }

    /**
     * 
     * @param {string} from_address 
     * @param {string} to_address 
     * @param {int} amount 
     * @returns {ret: number} 
     */
    async transfer_balance(from_address, to_address, amount) {
        assert(from_address != to_address, `from_address should not be equal to to_address ${from_address}`);

        assert(this.db != null, `db should not be null`);
        assert(typeof from_address === 'string', `from_address should be string`);
        assert(typeof to_address === 'string', `to_address should be string`);
        assert(Number.isInteger(amount), `amount should be integer`);

        // should exec in transaction
        assert(this.during_transaction, `should be during transaction`);

        const {ret: get_from_balance_ret, amount: from_balance} = await this.get_balance(from_address);
        if (get_from_balance_ret != 0) {
            console.error(`Could not get balance ${from_address}`);
            return { ret: -1 }; 
        }

        if (from_balance < amount) {
            console.error(`Insufficient balance ${from_address} : ${from_balance} < ${amount}`);
            return { ret: -1 };
        }

        const {ret: update_from_balance_ret} = await this.update_balance(from_address, -amount);
        if (update_from_balance_ret != 0) {
            console.error(`Could not update balance ${from_address}`);
            return { ret: -1 }; 
        }

        const {ret: update_to_balance_ret} = await this.update_balance(to_address, amount);
        if (update_to_balance_ret != 0) {
            console.error(`Could not update balance ${to_address}`);
            return { ret: -1 }; 
        }

        console.log(`transfer balance ${from_address} ${to_address} ${amount}`);
        return { ret: 0 };
    }

    // inscribe_data related methods

    async add_inscribe_data(hash, address, block_height, timestamp, text, price, resonance_count) {
        assert(this.db != null, `db should not be null`);
        assert(typeof hash === 'string', `hash should be string`);
        assert(typeof address === 'string', `address should be string`);
        if (text) {
            assert(typeof text === 'string', `text should be string`);
        }
        assert(Number.isInteger(block_height), `block_height should be integer`);
        assert(Number.isInteger(timestamp), `timestamp should be integer`);
        assert(
            Number.isInteger(price) && price >= 0,
            `price should be non-negative integer`,
        );
        assert(
            Number.isInteger(resonance_count) && resonance_count >= 0,
            `resonance_count should be non-negative integer`,
        );

        const sql = `
                INSERT INTO inscribe_data (hash, address, block_height, timestamp, text, price, resonance_count)
                VALUES (?, ?, ?, ?, ?)
            `;

        return new Promise((resolve, reject) => {
            this.db.run(
                sql,
                [hash, address, block_height, timestamp, text, price, resonance_count],
                (err) => {
                    if (err) {
                        if (err.code === 'SQLITE_CONSTRAINT') {
                            resolve({ ret: 1 });
                        } else {
                            console.error(
                                'Could not insert inscribe data',
                                err,
                            );
                            resolve({ ret: -1 });
                        }
                    } else {
                        resolve({ ret: 0 });
                    }
                },
            );
        });
    }

    async set_inscribe_data_price(hash, price) {
        const sql = `
                UPDATE inscribe_data SET price = ? WHERE hash = ?
            `;

        return new Promise((resolve, reject) => {
            this.db.run(sql, [price, hash], (err) => {
                if (err) {
                    console.error(
                        `Could not set inscribe data price ${hash}`,
                        err,
                    );
                    resolve({ ret: -1 });
                } else {
                    console.log(`set inscribe data price ${hash} to ${price}`);
                    resolve({ ret: 0 });
                }
            });
        });
    }

    async update_resonance_count(hash) {
        assert(this.db != null, `db should not be null`);
        assert(typeof hash === 'string', `hash should be string`);

        const sql = `
                UPDATE inscribe_data SET resonance_count = resonance_count + 1 WHERE hash = ? AND resonance_count < 15
            `;

        return new Promise((resolve, reject) => {
            this.db.run(sql, [hash], (err) => {
                if (err) {
                    console.error(
                        `Could not update resonance count ${hash}`,
                        err,
                    );
                    resolve({ ret: -1 });
                } else if (this.changes === 0) {
                    console.error(
                        `Could not update resonance count ${hash}, resonance count is 15`,
                    );
                    resolve({ ret: 1 });
                } else {
                    console.log(`update resonance count ${hash}`);
                    resolve({ ret: 0 });
                }
            });
        });
    }

    /**
     * 
     * @param {string} hash 
     * @returns {ret: number, data: object}
     */
    async get_inscribe_data(hash) {
        assert(this.db != null, `db should not be null`);
        assert(typeof hash === 'string', `hash should be string`);

        const sql = `
                SELECT * FROM inscribe_data WHERE hash = ?
            `;

        return new Promise((resolve, reject) => {
            this.db.get(sql, [hash], (err, row) => {
                if (err) {
                    console.error(`Could not get inscribe data ${hash}`, err);
                    resolve({ ret: -1 });
                } else {
                    resolve({ ret: 0, data: row });
                }
            });
        });
    }

    async append_user_op(address, inscription_id, block_height, op) {
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
        assert(typeof op === 'string', `op should be string`);

        const sql = `
            INSERT OR REPLACE INTO user_ops (address, inscription_id, block_height, op)
            VALUES (?, ?, ?, ?)
        `;

        return new Promise((resolve, reject) => {
            this.db.run(
                sql,
                [address, inscription_id, block_height, op],
                function (err) {
                    if (err) {
                        console.error(
                            `Could not append user op ${address} ${inscription_id} ${block_height} ${op}`,
                            err,
                        );
                        resolve({ ret: -1 });
                    } else {
                        console.log(
                            `append user op ${address} ${inscription_id} ${block_height} ${op}`,
                        );
                        resolve({ ret: 0 });
                    }
                },
            );
        });
    }

    async append_data_resonance(
        hash,
        inscription_id,
        address,
        block_height,
        amount,
    ) {
        assert(this.db != null, `db should not be null`);
        assert(typeof hash === 'string', `hash should be string`);
        assert(
            typeof inscription_id === 'string',
            `inscription_id should be string`,
        );
        assert(typeof address === 'string', `address should be string`);
        assert(
            Number.isInteger(block_height) && block_height >= 0,
            `block_height should be non-negative integer`,
        );
        assert(
            Number.isInteger(amount) && amount >= 0,
            `amount should be non-negative integer`,
        );

        const sql = `
            INSERT OR REPLACE INTO data_resonance (hash, inscription_id, address, block_height, amount)
            VALUES (?, ?, ?, ?, ?)
        `;

        return new Promise((resolve, reject) => {
            this.db.run(
                sql,
                [hash, inscription_id, address, block_height, amount],
                (err) => {
                    if (err) {
                        console.error(
                            `Could not append data resonance ${hash} ${inscription_id} ${address} ${block_height} ${amount}`,
                            err,
                        );
                        resolve({ ret: -1 });
                    } else {
                        console.log(
                            `append data resonance ${hash} ${inscription_id} ${address} ${block_height} ${amount}`,
                        );
                        resolve({ ret: 0 });
                    }
                },
            );
        });
    }

    async append_data_chant(
        hash,
        inscription_id,
        address,
        block_height,
        amount,
    ) {
        assert(this.db != null, `db should not be null`);
        assert(typeof hash === 'string', `hash should be string`);
        assert(
            typeof inscription_id === 'string',
            `inscription_id should be string`,
        );
        assert(typeof address === 'string', `address should be string`);
        assert(
            Number.isInteger(block_height) && block_height >= 0,
            `block_height should be non-negative integer`,
        );
        assert(
            Number.isInteger(amount) && amount >= 0,
            `amount should be non-negative integer`,
        );

        const sql = `
            INSERT OR REPLACE INTO data_chant (hash, inscription_id, address, block_height, amount)
            VALUES (?, ?, ?, ?, ?)
        `;

        return new Promise((resolve, reject) => {
            this.db.run(
                sql,
                [hash, inscription_id, address, block_height, amount],
                (err) => {
                    if (err) {
                        console.error(
                            `Could not append data chant ${hash} ${inscription_id} ${address} ${block_height} ${amount}`,
                            err,
                        );
                        resolve({ ret: -1 });
                    } else {
                        console.log(
                            `append data chant ${hash} ${inscription_id} ${address} ${block_height} ${amount}`,
                        );
                        resolve({ ret: 0 });
                    }
                },
            );
        });
    }
}

module.exports = { TokenIndexStorage };
