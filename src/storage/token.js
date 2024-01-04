const sqlite3 = require('sqlite3').verbose();
const assert = require('assert');
const path = require('path');
const { InscriptionStage } = require('../index/ops/state');
const { BigNumberUtil } = require('../util');
const {
    TOKEN_INDEX_DB_FILE,
    TOKEN_MINT_POOL_INIT_AMOUNT,
    TOKEN_MINT_POOL_VIRTUAL_ADDRESS,
    TOKEN_MINT_POOL_SERVICE_CHARGED_VIRTUAL_ADDRESS,
    TOKEN_MINT_POOL_LUCKY_MINT_VIRTUAL_ADDRESS,
    TOKEN_MINT_POOL_CHANT_VIRTUAL_ADDRESS,
} = require('../constants');
const { InscriptionOpState } = require('../index/ops/state');

// the ops that can update pool balance
const UpdatePoolBalanceOp = {
    Mint: 'mint',
    LuckyMint: 'lucky_mint',
    Chant: 'chant',
    InscribeData: 'inscribe_data',
};

class TokenIndexStorage {
    constructor(data_dir) {
        assert(
            typeof data_dir === 'string',
            `data_dir should be string: ${data_dir}`,
        );

        this.db_file_path = path.join(data_dir, TOKEN_INDEX_DB_FILE);
        this.db = null;
        this.during_transaction = false;
    }

    /**
     *
     * @returns {ret: number}
     */
    async init() {
        assert(this.db == null, `TokenIndexStorage db should be null`);

        // first init db
        const { ret } = await this._init_db();
        if (ret !== 0) {
            console.error(`failed to init token storage db`);
            return { ret };
        }

        // then init tables
        const { ret: ret2 } = await this._init_tables();
        if (ret2 !== 0) {
            console.error(`failed to init token storage tables`);
            return { ret: ret2 };
        }

        // then init data
        const { ret: ret3 } = await this._init_data();
        if (ret3 !== 0) {
            console.error(`failed to init token storage data`);
            return { ret: ret3 };
        }

        console.log(`init token storage success`);
        return { ret: 0 };
    }

    /**
     *
     * @returns {ret: number}
     */
    async _init_db() {
        assert(this.db == null, `TokenIndexStorage db should be null`);

        return new Promise((resolve) => {
            assert(this.db == null, `TokenIndexStorage db should be null`);
            this.db = new sqlite3.Database(this.db_file_path, (err) => {
                if (err) {
                    console.error(`failed to connect to sqlite: ${err}`);
                    resolve({ ret: -1 });
                    return;
                }

                console.log(`Connected to ${this.db_file_path}`);
                resolve({ ret: 0 });
            });
        });
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

                // Create mint_records table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS mint_records (
                        inscription_id TEXT PRIMARY KEY,
                        block_height INTEGER,
                        timestamp INTEGER,
                        txid TEXT,
                        address TEXT,
                        content TEXT,   
                        amount TEXT,
                        lucky TEXT DEFAULT NULL,
                        mint_type INTEGER,
                        state INTEGER DEFAULT 0
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

                // create index for txid and address field on mint_records table
                this.db.exec(
                    `CREATE INDEX IF NOT EXISTS idx_mint_records_txid ON mint_records (txid);
                     CREATE INDEX IF NOT EXISTS idx_mint_records_address ON mint_records (address);
                     `,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to create index on mint_records table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(`created index on mint_records table`);
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
                        txid TEXT,
                        content TEXT,
                        hash TEXT,
                        mint_amount TEXT,
                        service_charge TEXT,
                        text TEXT,
                        price TEXT,
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

                // create index for txid/address/hash field on inscribe_records table
                this.db.exec(
                    `CREATE INDEX IF NOT EXISTS idx_inscribe_records_txid ON inscribe_records (txid);
                     CREATE INDEX IF NOT EXISTS idx_inscribe_records_address ON inscribe_records (address);
                     CREATE INDEX IF NOT EXISTS idx_inscribe_records_hash ON inscribe_records (hash);
                     `,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to create index on inscribe_records table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(`created index on inscribe_records table`);
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
                        timestamp INTEGER,
                        txid TEXT,
                        address TEXT,
                        content TEXT,
                        hash TEXT,
                        user_bonus TEXT,
                        owner_bonus TEXT,
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

                // create index for hash/address/txid field on chant_records table
                this.db.exec(
                    `CREATE INDEX IF NOT EXISTS idx_chant_records_hash ON chant_records (hash);
                     CREATE INDEX IF NOT EXISTS idx_chant_records_address ON chant_records (address);
                     CREATE INDEX IF NOT EXISTS idx_chant_records_txid ON chant_records (txid);
                     `,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to create index on chant_records table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(`created index on chant_records table`);
                    },
                );

                if (has_error) {
                    return;
                }

                // Create transfer_records table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS transfer_records (
                        inscription_id TEXT PRIMARY KEY,
                        stage STRING,

                        genesis_block_height INTEGER,
                        genesis_timestamp INTEGER,
                        genesis_txid TEXT,
                        from_address TEXT,
                        content TEXT,

                        block_height INTEGER,
                        timestamp INTEGER,
                        txid TEXT,
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

                // create index for genesis_txid/txid/from_address/to_address field on transfer_records table
                this.db.exec(
                    `CREATE INDEX IF NOT EXISTS idx_transfer_records_genesis_txid ON transfer_records (genesis_txid);
                     CREATE INDEX IF NOT EXISTS idx_transfer_records_txid ON transfer_records (txid);
                     CREATE INDEX IF NOT EXISTS idx_transfer_records_from_address ON transfer_records (from_address);
                     CREATE INDEX IF NOT EXISTS idx_transfer_records_to_address ON transfer_records (to_address);
                     `,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to create index on transfer_records table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(`created index on transfer_records table`);
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
                        timestamp INTEGER,
                        txid TEXT,
                        content TEXT,
                        hash TEXT,
                        address TEXT,
                        price TEXT,
                        state INTEGER
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

                // create index on txid/address/hash field on set_price_records table
                this.db.exec(
                    `CREATE INDEX IF NOT EXISTS idx_set_price_records_txid ON set_price_records (txid);
                     CREATE INDEX IF NOT EXISTS idx_set_price_records_address ON set_price_records (address);
                     CREATE INDEX IF NOT EXISTS idx_set_price_records_hash ON set_price_records (hash);
                     `,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to create index on set_price_records table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(`created index on set_price_records table`);
                    },
                );

                if (has_error) {
                    return;
                }

                // Create resonance_records table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS resonance_records (
                        inscription_id TEXT PRIMARY KEY,
                        stage STRING,

                        genesis_block_height INTEGER,
                        genesis_timestamp INTEGER,
                        genesis_txid TEXT,
                        address TEXT,
                        hash TEXT,
                        content TEXT,

                        block_height INTEGER,
                        timestamp INTEGER,
                        txid TEXT,
                        owner_address TEXT,

                        owner_bonus TEXT,
                        service_charge TEXT,

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

                // Create index for hash and address field on resonance_records table
                this.db.exec(
                    `CREATE INDEX IF NOT EXISTS idx_resonance_records_hash ON resonance_records (hash);
                     CREATE INDEX IF NOT EXISTS idx_resonance_records_address ON resonance_records (address);
                     CREATE INDEX IF NOT EXISTS idx_resonance_records_genesis_txid ON resonance_records (genesis_txid);
                     `,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to create index on resonance_records table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(`created index on resonance_records table`);
                    },
                );

                if (has_error) {
                    return;
                }

                // Create balance table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS balance (
                        address TEXT PRIMARY KEY,
                        amount TEXT
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
    async _init_data() {
        assert(this.db != null, `db should not be null`);

        const { ret } = await this.init_balance(
            TOKEN_MINT_POOL_VIRTUAL_ADDRESS,
            TOKEN_MINT_POOL_INIT_AMOUNT,
        );
        if (ret !== 0) {
            console.error(`failed to init balance for mint pool`);
            return { ret };
        }

        const { ret: ret2 } = await this.init_balance(
            TOKEN_MINT_POOL_SERVICE_CHARGED_VIRTUAL_ADDRESS,
            '0',
        );
        if (ret2 !== 0) {
            console.error(`failed to init balance for mint pool charged`);
            return { ret: ret2 };
        }

        const { ret: ret3 } = await this.init_balance(
            TOKEN_MINT_POOL_LUCKY_MINT_VIRTUAL_ADDRESS,
            '0',
        );
        if (ret3 !== 0) {
            console.error(`failed to init balance for mint pool lucky mint`);
            return { ret: ret3 };
        }

        const { ret: ret4 } = await this.init_balance(
            TOKEN_MINT_POOL_CHANT_VIRTUAL_ADDRESS,
            '0',
        );
        if (ret4 !== 0) {
            console.error(`failed to init balance for mint pool chant`);
            return { ret: ret4 };
        }

        return { ret: 0 };
    }
    /**
     *
     * @returns {ret: number}
     */
    async begin_transaction() {
        assert(this.db != null, `db should not be null`);
        assert(!this.during_transaction, `should not be during transaction`);

        return new Promise((resolve) => {
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

        return new Promise((resolve) => {
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

    /**
     *
     * @param {string} inscription_id
     * @param {number} block_height
     * @param {number} timestamp
     * @param {string} txid
     * @param {string} address
     * @param {string} content
     * @param {string} amount
     * @param {string} lucky
     * @param {number} state
     * @returns {ret: number}
     */
    async add_mint_record(
        inscription_id,
        block_height,
        timestamp,
        txid,
        address,
        content,
        amount,
        lucky,
        mint_type,
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
        assert(Number.isInteger(timestamp), `timestamp should be integer`);
        assert(typeof txid === 'string', `txid should be string`);
        assert(typeof address === 'string', `address should be string`);
        assert(typeof content === 'string', `content should be string`);
        assert(
            BigNumberUtil.is_positive_number_string(amount),
            `amount should be positive number string`,
        );
        assert(
            lucky == null || typeof lucky === 'string',
            `lucky should be string or null`,
        );
        assert(_.isNumber(mint_type), `mint_type should be string ${mint_type}`);
        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer`,
        );

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR REPLACE INTO mint_records (
                    inscription_id, 
                    block_height, 
                    timestamp, 
                    txid,
                    address, 
                    content, 
                    amount, 
                    lucky,
                    mint_type,
                    state
                ) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    inscription_id,
                    block_height,
                    timestamp,
                    txid,
                    address,
                    content,
                    amount,
                    lucky,
                    mint_type,
                    state,
                ],
                (err) => {
                    if (err) {
                        console.error(
                            `failed to add mint record ${inscription_id}, ${err}`,
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
     * @param {number} block_height
     * @param {string} address
     * @param {number} timestamp
     * @param {string} txid
     * @param {string} hash
     * @param {string} content
     * @param {string} mint_amount
     * @param {string} service_charge
     * @param {string} text
     * @param {string} price
     * @param {number} state
     * @returns
     */
    async add_inscribe_data_record(
        inscription_id,
        block_height,
        address,
        timestamp,
        txid,
        hash,
        content,
        mint_amount,
        service_charge,
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
        assert(typeof txid === 'string', `txid should be string`);
        assert(typeof hash === 'string', `hash should be string`);
        assert(typeof content === 'string', `content should be string`);
        assert(
            BigNumberUtil.is_positive_number_string(mint_amount),
            `mint_amount should be positive number string ${mint_amount}`,
        );
        assert(
            BigNumberUtil.is_positive_number_string(service_charge),
            `service_charge should be positive number string ${service_charge}`,
        );
        assert(typeof text === 'string', `text should be string`);
        assert(
            BigNumberUtil.is_positive_number_string(price),
            `price should be positive number string ${price}`,
        );
        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer`,
        );

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR REPLACE INTO inscribe_records 
                    (inscription_id, 
                    block_height, 
                    address, 
                    timestamp, 
                    txid,
                    hash, 
                    content,
                    mint_amount, 
                    service_charge, 
                    text, 
                    price, 
                    state) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    inscription_id,
                    block_height,
                    address,
                    timestamp,
                    txid,
                    hash,
                    content,
                    mint_amount,
                    service_charge,
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

    /**
     *
     * @param {string} inscription_id
     * @returns {ret: number, data: object}
     */
    async query_inscribe_data_record(inscription_id) {
        assert(this.db != null, `db should not be null`);
        assert(typeof inscription_id === 'string', `should be string`);

        const sql = `
            SELECT * 
            FROM inscribe_records 
            WHERE inscription_id = ?
            LIMIT 1
        `;

        return new Promise((resolve) => {
            this.db.get(sql, [inscription_id], (err, row) => {
                if (err) {
                    console.error(
                        `Could not query inscribe data ${inscription_id} ${err}`,
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
     * @param {number} block_height
     * @param {number} timestamp
     * @param {string} txid
     * @param {string} address
     * @param {string} content
     * @param {string} hash
     * @param {string} user_bonus
     * @param {string} owner_bonus
     * @param {number} state
     * @returns {ret: number}
     */
    async add_chant_record(
        inscription_id,
        block_height,
        timestamp,
        txid,
        address,
        content,
        hash,
        user_bonus,
        owner_bonus,
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
        assert(typeof txid === 'string', `txid should be string`);
        assert(typeof content === 'string', `content should be string`);
        assert(typeof hash === 'string', `hash should be string ${hash}`);
        assert(
            BigNumberUtil.is_positive_number_string(user_bonus),
            `user_bonus should be positive number string ${user_bonus}`,
        );
        assert(
            BigNumberUtil.is_positive_number_string(owner_bonus),
            `owner_bonus should be positive number string ${owner_bonus}`,
        );
        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer ${state}`,
        );

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR REPLACE INTO chant_records (
                    inscription_id, 
                    block_height, 
                    timestamp,
                    txid,
                    address,
                    content,
                    hash, 
                    user_bonus, 
                    owner_bonus, 
                    state
                ) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    inscription_id,
                    block_height,
                    timestamp,
                    txid,
                    address,
                    content,
                    hash,
                    user_bonus,
                    owner_bonus,
                    state,
                ],
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

    /**
     *
     * @param {string} address
     * @returns {ret: number, data: object}
     */
    async get_user_last_chant(address) {
        assert(this.db != null, `db should not be null`);
        assert(typeof address === 'string', `address should be string`);

        const sql = `
            SELECT * 
            FROM chant_records 
            WHERE address = ? 
            ORDER BY block_height DESC 
            LIMIT 1
        `;

        return new Promise((resolve) => {
            this.db.get(sql, [address], (err, row) => {
                if (err) {
                    console.error(
                        `Could not get user last chant ${address} ${err}`,
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
     * @param {number} block_height
     * @param {number} timestamp
     * @param {string} txid
     * @param {string} from_address
     * @param {string} content
     * @param {number} state
     * @returns {ret: number}
     */
    async add_transfer_record_on_inscribed(
        inscription_id,
        block_height,
        timestamp,
        txid,
        address,
        content,
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
        assert(Number.isInteger(timestamp), `timestamp should be integer`);
        assert(typeof txid === 'string', `txid should be string`);
        assert(typeof address === 'string', `address should be string`);
        assert(typeof content === 'string', `content should be string`);
        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer`,
        );

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR REPLACE INTO transfer_records (
                    inscription_id, 
                    stage,

                    genesis_block_height,
                    genesis_timestamp,
                    genesis_txid,
                    from_address,
                    content,
        
                    block_height, 
                    timestamp,
                    txid,
                    to_address,

                    state
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    inscription_id,
                    InscriptionStage.Inscribe,

                    block_height,
                    timestamp,
                    txid,
                    address,
                    content,

                    0,
                    0,
                    null,
                    null,

                    state,
                ],
                (err) => {
                    if (err) {
                        console.error(
                            `failed to add transfer record on inscribed ${inscription_id} ${err}`,
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
     * @param {number} genesis_block_height
     * @param {number} genesis_timestamp
     * @param {string} genesis_txid
     * @param {string} from_address
     * @param {string} content
     * @param {number} block_height
     * @param {number} timestamp
     * @param {string} txid
     * @param {string} to_address
     * @param {number} state
     * @returns {ret: number}
     */
    async add_transfer_record_on_transferred(
        inscription_id,

        genesis_block_height,
        genesis_timestamp,
        genesis_txid,
        from_address,
        content,

        block_height,
        timestamp,
        txid,
        to_address,

        state,
    ) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof inscription_id === 'string',
            `inscription_id should be string`,
        );
        assert(
            Number.isInteger(genesis_block_height) && genesis_block_height >= 0,
            `genesis_block_height should be non-negative integer`,
        );
        assert(
            Number.isInteger(genesis_timestamp),
            `genesis_timestamp should be integer`,
        );
        assert(
            typeof genesis_txid === 'string',
            `genesis_txid should be string`,
        );
        assert(
            typeof from_address === 'string',
            `from_address should be string`,
        );
        assert(typeof content === 'string', `content should be string`);

        assert(
            Number.isInteger(block_height) && block_height >= 0,
            `block_height should be non-negative integer`,
        );
        assert(Number.isInteger(timestamp), `timestamp should be integer`);
        assert(typeof txid === 'string', `txid should be string`);
        assert(typeof to_address === 'string', `to_address should be string`);

        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer`,
        );

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR REPLACE INTO transfer_records (
                    inscription_id,
                    stage,

                    genesis_block_height,
                    genesis_timestamp,
                    genesis_txid,
                    from_address,
                    content,

                    block_height, 
                    timestamp,
                    txid,
                    to_address,

                    state
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    inscription_id,
                    InscriptionStage.Transfer,

                    genesis_block_height,
                    genesis_timestamp,
                    genesis_txid,
                    from_address,
                    content,

                    block_height,
                    timestamp,
                    txid,
                    to_address,

                    state,
                ],
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

    /**
     *
     * @param {string} inscription_id
     * @param {string} stage
     * @returns {ret: number, data: object}
     */
    async query_transfer_record(inscription_id, stage) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof inscription_id === 'string',
            `inscription_id should be string`,
        );
        assert(typeof stage === 'string', `stage should be string: ${stage}`);

        const sql = `
            SELECT * 
            FROM transfer_records 
            WHERE inscription_id = ? AND stage = ?
            LIMIT 1
        `;

        return new Promise((resolve) => {
            this.db.get(sql, [inscription_id, stage], (err, row) => {
                if (err) {
                    console.error(
                        `Could not query transfer record ${inscription_id} ${stage} ${err}`,
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
     * @param {number} block_height
     * @param {number} timestamp
     * @param {string} txid
     * @param {string} content
     * @param {string} hash
     * @param {string} address
     * @param {string} price
     * @returns {ret: number}
     */
    async add_set_price_record(
        inscription_id,
        block_height,
        timestamp,
        txid,
        content,
        hash,
        address,
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
        assert(Number.isInteger(timestamp), `timestamp should be integer`);
        assert(typeof txid === 'string', `txid should be string`);
        assert(typeof content === 'string', `content should be string`);
        assert(typeof hash === 'string', `hash should be string`);
        assert(typeof address === 'string', `address should be string`);
        assert(
            BigNumberUtil.is_positive_number_string(price),
            `price should be positive number string`,
        );
        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer`,
        );

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR REPLACE INTO set_price_records (
                    inscription_id, 
                    block_height, 
                    timestamp, 
                    txid,
                    content,
                    hash, 
                    address, 
                    price, 
                    state
                ) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    inscription_id,
                    block_height,
                    timestamp,
                    txid,
                    content,
                    hash,
                    address,
                    price,
                    state,
                ],
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

    /**
     *
     * @param {string} inscription_id
     * @param {number} block_height
     * @param {number} timestamp
     * @param {string} txid
     * @param {string} address
     * @param {string} hash
     * @param {string} content
     * @param {number} state
     * @returns {ret: number}
     */
    async add_resonance_record_on_inscribed(
        inscription_id,
        block_height,
        timestamp,
        txid,
        address,
        hash,
        content,
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
        assert(Number.isInteger(timestamp), `timestamp should be integer`);
        assert(typeof txid === 'string', `txid should be string`);
        assert(typeof address === 'string', `address should be string`);
        assert(typeof hash === 'string', `hash should be string`);
        assert(typeof content === 'string', `content should be string`);
        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer`,
        );

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR REPLACE INTO resonance_records 
                (
                    inscription_id, 
                    stage,

                    genesis_block_height,
                    genesis_timestamp,
                    genesis_txid,
                    address,
                    hash,
                    content,
                    
                    block_height,
                    timestamp,
                    txid,
                    owner_address,

                    owner_bonus,
                    service_charge,

                    state,
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    inscription_id,
                    InscriptionStage.Inscribe,

                    block_height,
                    timestamp,
                    txid,
                    address,
                    hash,
                    content,

                    0,
                    0,
                    null,
                    null,

                    0,
                    0,

                    state,
                ],
                (err) => {
                    if (err) {
                        console.error(
                            'failed to add resonance inscribed record',
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
     * @param {number} genesis_block_height
     * @param {number} genesis_timestamp
     * @param {string} genesis_txid
     * @param {string} address
     * @param {string} hash
     * @param {string} content
     * @param {number} block_height
     * @param {number} timestamp
     * @param {string} txid
     * @param {string} owner_address
     * @param {string} owner_bonus
     * @param {string} service_charge
     * @param {number} state
     * @returns {ret: number}
     */
    async add_resonance_record_on_transferred(
        inscription_id,

        genesis_block_height,
        genesis_timestamp,
        genesis_txid,
        address,
        hash,
        content,

        block_height,
        timestamp,
        txid,
        owner_address,

        owner_bonus,
        service_charge,

        state,
    ) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof inscription_id === 'string',
            `inscription_id should be string`,
        );

        assert(
            Number.isInteger(genesis_block_height) && genesis_block_height >= 0,
            `genesis_block_height should be non-negative integer`,
        );
        assert(
            Number.isInteger(genesis_timestamp),
            `genesis_timestamp should be integer`,
        );
        assert(
            typeof genesis_txid === 'string',
            `genesis_txid should be string`,
        );
        assert(typeof address === 'string', `address should be string`);
        assert(typeof hash === 'string', `hash should be string`);
        assert(typeof content === 'string', `content should be string`);

        assert(
            Number.isInteger(block_height) && block_height >= 0,
            `block_height should be non-negative integer`,
        );
        assert(Number.isInteger(timestamp), `timestamp should be integer`);
        assert(typeof txid === 'string', `txid should be string`);
        assert(
            typeof owner_address === 'string',
            `owner_address should be string`,
        );

        assert(
            BigNumberUtil.is_positive_number_string(owner_bonus),
            `owner_bonus should be positive number string ${owner_bonus}`,
        );
        assert(
            BigNumberUtil.is_positive_number_string(service_charge),
            `service_charge should be positive number string ${service_charge}`,
        );

        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer`,
        );

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR REPLACE INTO resonance_records 
                (
                    inscription_id,
                    stage,

                    genesis_block_height,
                    genesis_timestamp,
                    genesis_txid,
                    address,
                    hash,
                    content,
                    
                    block_height,
                    timestamp,
                    txid,
                    owner_address,

                    owner_bonus,
                    service_charge,

                    state,
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [
                    inscription_id,
                    InscriptionStage.Transfer,

                    genesis_block_height,
                    genesis_timestamp,
                    genesis_txid,
                    address,
                    hash,
                    content,

                    block_height,
                    timestamp,
                    txid,
                    owner_address,

                    owner_bonus,
                    service_charge,

                    state,
                ],
                (err) => {
                    if (err) {
                        console.error(
                            `failed to add resonance transferred record: ${inscription_id} ${err}`,
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
     * @param {string} stage
     * @returns {ret: number, data: object | null}
     */
    async query_resonance_record(inscription_id, stage) {
        assert(this.db != null, `db should not be null`);
        assert(typeof inscription_id === 'string', `should be string`);
        assert(typeof stage === 'string', `stage should be string: ${stage}`);

        const sql = `
            SELECT * 
            FROM resonance_records 
            WHERE inscription_id = ? AND stage = ?
            LIMIT 1
        `;

        return new Promise((resolve) => {
            this.db.get(sql, [inscription_id, stage], (err, row) => {
                if (err) {
                    console.error(
                        `Could not query resonance ${inscription_id} ${stage} ${err}`,
                    );
                    resolve({ ret: -1 });
                } else {
                    resolve({ ret: 0, data: row });
                }
            });
        });
    }
    /**
     * check user's last resonance record on a data hash
     * @param {string} address
     * @param {string} hash
     * @returns {ret: number, data: object}
     */
    async query_user_resonance(address, hash) {
        const sql = `
            SELECT * 
            FROM resonance_records 
            WHERE address = ? AND hash = ? AND state = 0 
            ORDER BY block_height DESC 
            LIMIT 1
        `;

        return new Promise((resolve) => {
            this.db.get(sql, [address, hash], (err, row) => {
                if (err) {
                    console.error(
                        `Could not query user resonance ${address} ${hash} ${err}`,
                    );
                    resolve({ ret: -1 });
                } else {
                    resolve({ ret: 0, data: row });
                }
            });
        });
    }

    /**
     * @comment set the init balance for address, if address exists, do nothing
     * @param {string} address
     * @param {string} amount
     * @returns {ret: number}
     */
    async init_balance(address, amount) {
        assert(this.db != null, `db should not be null`);
        assert(typeof address === 'string', `address should be string`);
        assert(
            BigNumberUtil.is_positive_number_string(amount),
            `amount should be valid number string: ${amount}`,
        );

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR IGNORE INTO balance (address, amount) VALUES (?, ?)`,
                [address, amount],
                (err) => {
                    if (err) {
                        console.error('failed to init balance', err);
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0 });
                    }
                },
            );
        });
    }

    /**
     * @comment set the balance for address, if address exists, update it
     * @param {string} address
     * @param {string} amount
     * @returns {ret: number}
     */
    async set_balance(address, amount) {
        assert(this.db != null, `db should not be null`);
        assert(typeof address === 'string', `address should be string`);
        assert(
            BigNumberUtil.is_positive_number_string(amount),
            `amount should be valid number string: ${amount}`,
        );

        return new Promise((resolve) => {
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

    /**
     * @comment update balance for address, return InscriptionOpState.INSUFFICIENT_BALANCE if balance is not enough, return -1 on error, return 0 on success
     * @param {string} address
     * @param {string} amount
     * @returns {ret: number}
     */
    async update_balance(address, amount) {
        assert(this.db != null, `db should not be null`);
        assert(typeof address === 'string', `address should be string`);
        assert(
            BigNumberUtil.is_number_string(amount),
            `amount should be valid number string: ${amount}`,
        );

        return new Promise((resolve) => {
            this.db.get(
                'SELECT amount FROM balance WHERE address = ?',
                [address],
                (err, row) => {
                    if (err) {
                        console.error(
                            `Could not get balance for address ${address}, ${err}`,
                        );
                        resolve({ ret: -1 });
                    } else {
                        if (row == null) {
                            // balance should >= 0
                            if (BigNumberUtil.compare(amount, '0') < 0) {
                                console.error(
                                    `init amount ${amount} is negative`,
                                );
                                resolve({
                                    ret: InscriptionOpState.INSUFFICIENT_BALANCE,
                                });
                            }

                            this.db.run(
                                'INSERT INTO balance (address, amount) VALUES (?, ?)',
                                [address, amount],
                                (err) => {
                                    if (err) {
                                        console.error(
                                            `Could not insert balance for address ${address}, ${err}`,
                                        );
                                        resolve({ ret: -1 });
                                    } else {
                                        console.log(
                                            `first inserted balance for address ${address} ${amount}`,
                                        );
                                        resolve({ ret: 0 });
                                    }
                                },
                            );
                        } else {
                            const current_amount = row.amount;
                            const new_amount = BigNumberUtil.add(
                                current_amount,
                                amount,
                            );

                            // new_amount should >= 0
                            if (BigNumberUtil.compare(new_amount, '0') < 0) {
                                console.error(
                                    `new amount ${new_amount} is negative, current amount ${current_amount}, amount ${amount}`,
                                );
                                resolve({
                                    ret: InscriptionOpState.INSUFFICIENT_BALANCE,
                                });
                            }

                            this.db.run(
                                'UPDATE balance SET amount = ? WHERE address = ?',
                                [new_amount, address],
                                (err) => {
                                    if (err) {
                                        console.error(
                                            `Could not update balance for address ${address}, ${err}`,
                                        );
                                        resolve({ ret: -1 });
                                    } else {
                                        console.log(
                                            `updated balance for address ${address} ${current_amount} -> ${new_amount}`,
                                        );
                                        resolve({ ret: 0 });
                                    }
                                },
                            );
                        }
                    }
                },
            );
        });
    }

    /**
     * @comment update pool balance on mint or chant or resonance
     * @param {UpdatePoolBalanceOp} op
     * @param {string} amount
     * @returns {ret: number}
     */
    async update_pool_balance_on_ops(op, amount) {
        assert(this.db != null, `db should not be null`);
        assert(
            BigNumberUtil.is_positive_number_string(amount),
            `amount should be >= 0 number string: ${amount}`,
        );

        switch (op) {
            case UpdatePoolBalanceOp.Mint:
                {
                    const { ret: update_ret } = await this.update_balance(
                        TOKEN_MINT_POOL_VIRTUAL_ADDRESS,
                        BigNumberUtil.multiply(amount, -1),
                    );
                    if (update_ret != 0) {
                        console.error(
                            `Could not update pool balance on mint ${TOKEN_MINT_POOL_VIRTUAL_ADDRESS}`,
                        );
                        return { ret: update_ret };
                    }
                }

                break;
            case UpdatePoolBalanceOp.LuckyMint:
                {
                    const { ret } = await this.update_balance(
                        TOKEN_MINT_POOL_LUCKY_MINT_VIRTUAL_ADDRESS,
                        amount,
                    );
                    if (ret != 0) {
                        console.error(
                            `Could not update lucky mint balance ${TOKEN_MINT_POOL_LUCKY_MINT_VIRTUAL_ADDRESS}`,
                        );
                        return { ret };
                    }

                    const { ret: update_ret } = await this.update_balance(
                        TOKEN_MINT_POOL_VIRTUAL_ADDRESS,
                        BigNumberUtil.multiply(amount, -1),
                    );
                    if (update_ret != 0) {
                        console.error(
                            `Could not update pool balance on lucky mint ${TOKEN_MINT_POOL_VIRTUAL_ADDRESS}`,
                        );
                        return { ret: update_ret };
                    }
                }

                break;
            case UpdatePoolBalanceOp.Chant:
                {
                    const { ret } = await this.update_balance(
                        TOKEN_MINT_POOL_CHANT_VIRTUAL_ADDRESS,
                        amount,
                    );
                    if (ret != 0) {
                        console.error(
                            `Could not update chant balance ${TOKEN_MINT_POOL_LUCKY_MINT_VIRTUAL_ADDRESS}`,
                        );
                        return { ret };
                    }

                    const { ret: update_ret } = await this.update_balance(
                        TOKEN_MINT_POOL_VIRTUAL_ADDRESS,
                        BigNumberUtil.multiply(amount, -1),
                    );
                    if (update_ret != 0) {
                        console.error(
                            `Could not update pool balance on chant ${TOKEN_MINT_POOL_VIRTUAL_ADDRESS}`,
                        );
                        return { ret: update_ret };
                    }
                }

                break;
            case UpdatePoolBalanceOp.InscribeData:
                {
                    const { ret } = await this.update_balance(
                        TOKEN_MINT_POOL_SERVICE_CHARGED_VIRTUAL_ADDRESS,
                        amount,
                    );
                    if (ret != 0) {
                        assert(ret < 0);
                        console.error(
                            `Could not update inscribe data service charge balance ${TOKEN_MINT_POOL_SERVICE_CHARGED_VIRTUAL_ADDRESS}`,
                        );
                        return { ret };
                    }

                    const { ret: update_ret } = await this.update_balance(
                        TOKEN_MINT_POOL_VIRTUAL_ADDRESS,
                        amount,
                    );
                    if (update_ret != 0) {
                        assert(ret < 0);
                        console.error(
                            `Could not update pool balance on resonance ${TOKEN_MINT_POOL_VIRTUAL_ADDRESS}`,
                        );
                        return { ret: update_ret };
                    }
                }

                break;

            default: {
                console.error(`Unknown update_pool_balance_on_ops op ${op}`);
                return { ret: -1 };
            }
        }

        return { ret: 0 };
    }
    /**
     *
     * @param {string} address
     * @returns {ret: number, amount: string}
     */
    async get_balance(address) {
        const sql = `
            SELECT amount FROM balance WHERE address = ?
        `;

        return new Promise((resolve) => {
            this.db.get(sql, [address], (err, row) => {
                if (err) {
                    console.error('Could not get balance', err);
                    resolve({ ret: -1 });
                } else {
                    resolve({ ret: 0, amount: row ? row.amount : '0' });
                }
            });
        });
    }

    /**
     * @comment get balances for addresses
     * @param {Array} addresses
     * @returns {ret: number, balances: object}
     */
    async get_balances(addresses) {
        assert(Array.isArray(addresses), `addresses should be array`);

        const sql = `
            SELECT address, amount FROM balance WHERE address IN (${addresses
                .map(() => '?')
                .join(',')})
        `;

        return new Promise((resolve) => {
            this.db.all(sql, addresses, (err, rows) => {
                if (err) {
                    console.error('Could not get balances', err);
                    resolve({ ret: -1 });
                } else {
                    const balances = {};
                    for (const row of rows) {
                        balances[row.address] = row.amount;
                    }
                    resolve({ ret: 0, balances });
                }
            });
        });
    }

    /**
     * @comment transfer balance from from_address to to_address, return InscriptionOpState.INSUFFICIENT_BALANCE if balance is not enough, return -1 on error, return 0 on success
     * @param {string} from_address
     * @param {string} to_address
     * @param {string} amount
     * @returns {ret: number}
     */
    async transfer_balance(from_address, to_address, amount) {
        assert(
            from_address != to_address,
            `from_address should not be equal to to_address ${from_address}`,
        );

        assert(this.db != null, `db should not be null`);
        assert(
            typeof from_address === 'string',
            `from_address should be string`,
        );
        assert(typeof to_address === 'string', `to_address should be string`);
        assert(
            BigNumberUtil.is_positive_number_string(amount),
            `amount should be valid number string: ${amount}`,
        );

        // should exec in transaction
        assert(this.during_transaction, `should be during transaction`);

        const { ret: get_from_balance_ret, amount: from_balance } =
            await this.get_balance(from_address);
        if (get_from_balance_ret != 0) {
            console.error(`Could not get balance ${from_address}`);
            return { ret: get_from_balance_ret };
        }

        if (BigNumberUtil.compare(from_balance, amount) < 0) {
            console.error(
                `Insufficient balance ${from_address} : ${from_balance} < ${amount}`,
            );
            return { ret: InscriptionOpState.INSUFFICIENT_BALANCE };
        }

        const new_amount = BigNumberUtil.subtract(from_balance, amount);
        const { ret: update_from_balance_ret } = await this.set_balance(
            from_address,
            new_amount,
        );
        if (update_from_balance_ret != 0) {
            console.error(`Could not update balance ${from_address}`);
            return { ret: update_from_balance_ret };
        }

        const { ret: update_to_balance_ret } = await this.update_balance(
            to_address,
            amount,
        );
        if (update_to_balance_ret != 0) {
            console.error(`Could not update balance ${to_address}`);
            return { ret: -1 };
        }

        console.log(`transfer balance ${from_address} ${to_address} ${amount}`);
        return { ret: 0 };
    }

    // inscribe_data related methods
    /**
     *
     * @param {string} hash
     * @param {string} address
     * @param {number} block_height
     * @param {number} timestamp
     * @param {string} text
     * @param {string} price
     * @param {number} resonance_count
     * @returns
     */
    async add_inscribe_data(
        hash,
        address,
        block_height,
        timestamp,
        text,
        price,
        resonance_count,
    ) {
        assert(this.db != null, `db should not be null`);
        assert(typeof hash === 'string', `hash should be string`);
        assert(typeof address === 'string', `address should be string`);
        if (text) {
            assert(typeof text === 'string', `text should be string`);
        }
        assert(
            Number.isInteger(block_height),
            `block_height should be integer`,
        );
        assert(Number.isInteger(timestamp), `timestamp should be integer`);
        assert(
            BigNumberUtil.is_positive_number_string(price),
            `price should be positive number string: ${price}`,
        );
        assert(
            Number.isInteger(resonance_count) && resonance_count >= 0,
            `resonance_count should be non-negative integer`,
        );

        const sql = `
                INSERT INTO inscribe_data (hash, address, block_height, timestamp, text, price, resonance_count)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

        return new Promise((resolve) => {
            this.db.run(
                sql,
                [
                    hash,
                    address,
                    block_height,
                    timestamp,
                    text,
                    price,
                    resonance_count,
                ],
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

    /**
     *
     * @param {string} hash
     * @param {string} price
     * @returns {ret: number}
     */
    async set_inscribe_data_price(hash, price) {
        assert(this.db != null, `db should not be null`);
        assert(typeof hash === 'string', `hash should be string`);
        assert(
            BigNumberUtil.is_positive_number_string(price),
            `price should be positive number string: ${price}`,
        );

        const sql = `
                UPDATE inscribe_data SET price = ? WHERE hash = ?
            `;

        return new Promise((resolve) => {
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

    /**
     *
     * @param {string} hash
     * @returns {ret: number}
     */
    async update_resonance_count(hash) {
        assert(this.db != null, `db should not be null`);
        assert(typeof hash === 'string', `hash should be string`);

        const sql = `
                UPDATE inscribe_data SET resonance_count = resonance_count + 1 WHERE hash = ? AND resonance_count < 15
            `;

        return new Promise((resolve) => {
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
     * @comment update inscribe data owner+block_height+timestamp where hash and block_height match
     * @param {string} hash
     * @param {number} current_block_height
     * @param {string} new_owner
     * @param {number} new_block_height
     * @param {number} new_timestamp
     * @returns {ret: number}
     */
    async transfer_inscribe_data_owner(
        hash,
        current_block_height,
        new_owner,
        new_block_height,
        new_timestamp,
    ) {
        assert(this.db != null, `db should not be null`);
        assert(
            _.isNumber(current_block_height),
            `current_block_height should be number`,
        );
        assert(typeof hash === 'string', `hash should be string`);
        assert(typeof new_owner === 'string', `new_owner should be string`);
        assert(
            Number.isInteger(new_block_height),
            `new_block_height should be integer`,
        );
        assert(
            Number.isInteger(new_timestamp),
            `new_timestamp should be integer`,
        );

        const sql = `
                UPDATE inscribe_data SET address = ?, block_height = ?, timestamp = ? WHERE hash = ? AND block_height = ?
            `;

        return new Promise((resolve) => {
            this.db.run(
                sql,
                [
                    new_owner,
                    new_block_height,
                    new_timestamp,
                    hash,
                    current_block_height,
                ],
                (err) => {
                    if (err) {
                        console.error(
                            `Could not update inscribe data owner ${hash}`,
                            err,
                        );
                        resolve({ ret: -1 });
                    } else if (this.changes === 0) {
                        console.error(
                            `Could not update inscribe data owner ${hash}, block_height is not match`,
                        );
                        resolve({ ret: 1 });
                    } else {
                        console.log(`update inscribe data owner ${hash}`);
                        resolve({ ret: 0 });
                    }
                },
            );
        });
    }

    /**
     *
     * @param {string} hash
     * @returns {ret: number, data: object | null}
     */
    async get_inscribe_data(hash) {
        assert(this.db != null, `db should not be null`);
        assert(typeof hash === 'string', `hash should be string`);

        const sql = `
                SELECT * FROM inscribe_data WHERE hash = ?
            `;

        return new Promise((resolve) => {
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

        return new Promise((resolve) => {
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
}

module.exports = { UpdatePoolBalanceOp, TokenIndexStorage };
