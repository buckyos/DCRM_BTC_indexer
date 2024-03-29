const sqlite3 = require('sqlite3').verbose();
const assert = require('assert');
const path = require('path');
const { InscriptionStage } = require('../token_index/ops/state');
const { BigNumberUtil } = require('../util');
const { TOKEN_INDEX_DB_FILE } = require('../constants');
const { InscriptionOp } = require('../index/item');
const { UserHashRelationStorage } = require('./relation');
const { TokenBalanceStorage, UpdatePoolBalanceOp } = require('./balance');
const { Util } = require('../util');
const { TokenOpsStorage } = require('./ops');

// the user ops
const UserOp = {
    Mint: 'mint',

    InscribeData: 'inscribe_data',
    TransferData: 'transfer_data',

    Chant: 'chant',
    Resonance: 'res',

    InscribeTransfer: 'inscribe_transfer',
    Transfer: 'transfer',
    Exchange: 'exchange',

    SetPrice: 'set_price',
};

class TokenIndexStorage {
    constructor(config) {
        const { ret, dir: data_dir } = Util.get_data_dir(config);
        if (ret !== 0) {
            throw new Error(`failed to get data dir`);
        }

        assert(
            typeof data_dir === 'string',
            `data_dir should be string: ${data_dir}`,
        );

        this.config = config;
        this.db_file_path = path.join(data_dir, TOKEN_INDEX_DB_FILE);
        this.db = null;
        this.during_transaction = false;
        this.user_hash_relation_storage = new UserHashRelationStorage();
        this.balance_storage = new TokenBalanceStorage(this, config);
        this.ops_storage = new TokenOpsStorage(config);
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

        // then init balance storage
        const { ret: ret3 } = await this.balance_storage.init(this.db);
        if (ret3 !== 0) {
            console.error(`failed to init token balance storage`);
            return { ret: ret3 };
        }

        // then init ops storage
        const { ret: ret4 } = await this.ops_storage.init(this.db);
        if (ret4 !== 0) {
            console.error(`failed to init token ops storage`);
            return { ret: ret4 };
        }

        // then init user hash relation storage
        const { ret: ret5 } = await this.user_hash_relation_storage.init(
            this.db,
        );
        if (ret4 !== 0) {
            console.error(`failed to init user hash relation storage`);
            return { ret: ret5 };
        }

        console.log(`init token storage success`);
        return { ret: 0 };
    }

    /**
     * @returns {UserHashRelationStorage}
     */
    get_user_hash_relation_storage() {
        return this.user_hash_relation_storage;
    }

    /**
     *
     * @returns {TokenBalanceStorage}
     */
    get_balance_storage() {
        return this.balance_storage;
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
                        inner_amount TEXT,
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
                     CREATE INDEX IF NOT EXISTS idx_mint_records_address_lucky ON mint_records (address, lucky);
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

                // Create inscribe_data_transfer_records table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS inscribe_data_transfer_records (
                        inscription_id TEXT,
                        hash TEXT,
                        block_height INTEGER,
                        timestamp INTEGER,
                        txid TEXT,
                        satpoint TEXT,
                        from_address TEXT,
                        to_address TEXT,
                        value INTEGER,
                        state INTEGER DEFAULT 0,
                        PRIMARY KEY (inscription_id, txid)
                    )`,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to create inscribe_data_transfer_records table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(
                            `created inscribe_data_transfer_records table`,
                        );
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
                        hash_point INTEGER,
                        hash_weight TEXT,
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
                        timestamp INTEGER,
                        txid TEXT,
                        address TEXT,
                        content TEXT,
                        hash TEXT,
                        user_bonus TEXT,
                        owner_bonus TEXT,
                        hash_point INTEGER,
                        hash_weight TEXT,
                        chant_type INTEGER,
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
                        hash_point INTEGER,
                        hash_weight TEXT,
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
                        
                        block_height INTEGER,
                        timestamp INTEGER,
                        txid TEXT,
                        content TEXT,
                        hash TEXT,
                        address TEXT,

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
                     CREATE INDEX IF NOT EXISTS idx_resonance_records_txid ON resonance_records (txid);
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

                // Create inscribe_data table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS inscribe_data (
                        hash TEXT PRIMARY KEY,

                        inscription_id TEXT,

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

                resolve({ ret: 0 });
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
        inner_amount,
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
            BigNumberUtil.is_positive_number_string(inner_amount),
            `inner_amount should be positive number string`,
        );
        assert(
            lucky == null || typeof lucky === 'string',
            `lucky should be string or null`,
        );
        assert(
            _.isNumber(mint_type),
            `mint_type should be string ${mint_type}`,
        );
        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer`,
        );

        // first append user op
        const { ret: user_op_ret } = await this.ops_storage.add_user_op(
            address,
            inscription_id,
            block_height,
            timestamp,
            txid,
            UserOp.Mint,
            state,
        );
        if (user_op_ret !== 0) {
            console.error(
                `failed to add user mint op ${inscription_id} ${address} ${block_height}`,
            );
            return { ret: user_op_ret };
        }

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
                    inner_amount,
                    lucky,
                    mint_type,
                    state
                ) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    inscription_id,
                    block_height,
                    timestamp,
                    txid,
                    address,
                    content,
                    amount,
                    inner_amount,
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
     * @param {string} address
     * @param {string} lucky
     * @returns {ret: number, data: object}
     */
    async query_lucky_mint(address, lucky) {
        assert(this.db != null, `db should not be null`);
        assert(typeof address === 'string', `address should be string`);
        assert(typeof lucky === 'string', `lucky should be string`);

        const sql = `
            SELECT * 
            FROM mint_records 
            WHERE address = ? AND lucky = ?
            LIMIT 1
        `;

        return new Promise((resolve) => {
            this.db.get(sql, [address, lucky], (err, row) => {
                if (err) {
                    console.error(
                        `Could not query lucky mint ${address} ${lucky} ${err}`,
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
     * @param {string} address
     * @param {number} timestamp
     * @param {string} txid
     * @param {string} hash
     * @param {string} content
     * @param {string} mint_amount
     * @param {string} service_charge
     * @param {string} text
     * @param {string} price
     * @param {number} hash_point
     * @param {number} hash_weight
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
        hash_point,
        hash_weight,
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
        assert(Util.is_valid_and_strict_hex_mixhash(hash), `hash should be valid hex mixhash: ${hash}`);
        assert(typeof content === 'string', `content should be string`);
        assert(
            BigNumberUtil.is_positive_number_string(mint_amount),
            `mint_amount should be positive number string ${mint_amount}`,
        );
        assert(
            BigNumberUtil.is_positive_number_string(service_charge),
            `service_charge should be positive number string ${service_charge}`,
        );
        assert(
            text == null || typeof text === 'string',
            `text should be string`,
        );
        assert(
            BigNumberUtil.is_positive_number_string(price),
            `price should be positive number string ${price}`,
        );
        assert(
            Number.isInteger(hash_point) && hash_point >= 0,
            `hash_point should be non-negative integer ${hash_point}`,
        );
        assert(
            BigNumberUtil.is_positive_number_string(hash_weight),
            `hash_weight should be non-negative number string ${hash_weight}`,
        );
        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer`,
        );

        // first append user op
        const { ret: user_op_ret } = await this.ops_storage.add_user_op(
            address,
            inscription_id,
            block_height,
            timestamp,
            txid,
            UserOp.InscribeData,
            state,
        );
        if (user_op_ret !== 0) {
            console.error(
                `failed to add user inscribe data op ${inscription_id} ${address} ${block_height}`,
            );
            return { ret: user_op_ret };
        }

        // then append data op
        const total_amount = BigNumberUtil.add(mint_amount, service_charge);
        const { ret: data_op_ret } = await this.ops_storage.add_data_op(
            hash,
            inscription_id,
            block_height,
            timestamp,
            txid,
            address,
            BigNumberUtil.multiply(total_amount, '-1'),
            UserOp.InscribeData,
            state,
        );
        if (data_op_ret !== 0) {
            console.error(
                `failed to add data op ${inscription_id} ${address} ${block_height}`,
            );
            return { ret: data_op_ret };
        }

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
                    hash_point,
                    hash_weight,
                    state) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                    hash_point,
                    hash_weight,
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
     * @comment: this function is used to add inscribe data transfer record
     * @param {string} inscription_id
     * @param {string} hash
     * @param {number} block_height
     * @param {number} timestamp
     * @param {string} txid
     * @param {string} satpoint
     * @param {string} from_address
     * @param {string} to_address
     * @param {number} value
     * @param {number} state
     * @returns {ret: number}
     */
    async add_inscribe_data_transfer_record(
        inscription_id,
        hash,
        block_height,
        timestamp,
        txid,
        satpoint,
        from_address,
        to_address,
        value,
        state,
    ) {
        assert(this.db != null, `db should not be null`);
        assert(typeof inscription_id === 'string', `should be string`);
        assert(Util.is_valid_and_strict_hex_mixhash(hash), `hash should be valid hex mixhash: ${hash}`);
        assert(
            Number.isInteger(block_height) && block_height >= 0,
            `should be non-negative integer`,
        );
        assert(Number.isInteger(timestamp), `should be integer`);
        assert(typeof txid === 'string', `should be string`);
        assert(typeof satpoint === 'string', `should be string`);
        assert(typeof from_address === 'string', `should be string`);
        assert(typeof to_address === 'string', `should be string`);
        assert(
            _.isNumber(value) && value >= 0,
            `should be positive number ${value}`,
        );
        assert(
            Number.isInteger(state) && state >= 0,
            `should be non-negative integer`,
        );

        // first append user op
        const { ret: user_op_ret } = await this.ops_storage.add_user_op(
            from_address,
            inscription_id,
            block_height,
            timestamp,
            txid,
            UserOp.TransferData,
            state,
        );
        if (user_op_ret !== 0) {
            console.error(
                `failed to add user inscribe data transfer op ${inscription_id} ${from_address} ${block_height}`,
            );
            return { ret: user_op_ret };
        }

        // then append data op
        const { ret: data_op_ret } = await this.ops_storage.add_data_op(
            hash,
            inscription_id,
            block_height,
            timestamp,
            txid,
            from_address,
            '0',
            UserOp.TransferData,
            state,
        );
        if (data_op_ret !== 0) {
            console.error(
                `failed to add data op ${inscription_id} ${from_address} ${block_height}`,
            );
            return { ret: data_op_ret };
        }

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR REPLACE INTO inscribe_data_transfer_records 
                    (inscription_id, 
                    hash,
                    block_height, 
                    timestamp, 
                    txid,
                    satpoint,
                    from_address, 
                    to_address,
                    value,
                    state) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    inscription_id,
                    hash,
                    block_height,
                    timestamp,
                    txid,
                    satpoint,
                    from_address,
                    to_address,
                    value,
                    state,
                ],
                (err) => {
                    if (err) {
                        console.error(
                            'failed to add inscribe data transfer record',
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
     * @param {number} block_height
     * @param {number} timestamp
     * @param {string} txid
     * @param {string} address
     * @param {string} content
     * @param {string} hash
     * @param {string} user_bonus
     * @param {string} owner_bonus
     * @param {number} hash_point
     * @param {string} hash_weight
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
        hash_point,
        hash_weight,
        chant_type,
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
        assert(Util.is_valid_and_strict_hex_mixhash(hash), `hash should be valid hex mixhash: ${hash}`);
        assert(
            BigNumberUtil.is_positive_number_string(user_bonus),
            `user_bonus should be positive number string ${user_bonus}`,
        );
        assert(
            BigNumberUtil.is_positive_number_string(owner_bonus),
            `owner_bonus should be positive number string ${owner_bonus}`,
        );
        assert(
            Number.isInteger(hash_point) && hash_point >= 0,
            `hash_point should be non-negative integer ${hash_point}`,
        );
        assert(
            BigNumberUtil.is_positive_number_string(hash_weight),
            `hash_weight should be non-negative number string ${hash_weight}`,
        );
        assert(
            _.isNumber(chant_type),
            `chant_type should be number ${chant_type}`,
        );
        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer ${state}`,
        );

        // first append user op
        const { ret: user_op_ret } = await this.ops_storage.add_user_op(
            address,
            inscription_id,
            block_height,
            timestamp,
            txid,
            InscriptionOp.Chant,
            state,
        );
        if (user_op_ret !== 0) {
            console.error(
                `failed to add user chant op ${inscription_id} ${address} ${block_height}`,
            );
            return { ret: user_op_ret };
        }

        // then append data op
        const total_bonus = BigNumberUtil.add(user_bonus, owner_bonus);
        const { ret: data_op_ret } = await this.ops_storage.add_data_op(
            hash,
            inscription_id,
            block_height,
            timestamp,
            txid,
            address,
            total_bonus,
            InscriptionOp.Chant,
            state,
        );
        if (data_op_ret !== 0) {
            console.error(
                `failed to add data op ${inscription_id} ${address} ${block_height}`,
            );
            return { ret: data_op_ret };
        }

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
                    hash_point,
                    hash_weight,
                    chant_type,
                    state
                ) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                    hash_point,
                    hash_weight,
                    chant_type,
                    state,
                ],
                (err) => {
                    if (err) {
                        console.error(
                            `failed to add chant record ${inscription_id} ${err}`,
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

        // first append user op
        const { ret: user_op_ret } = await this.ops_storage.add_user_op(
            address,
            inscription_id,
            block_height,
            timestamp,
            txid,
            UserOp.InscribeTransfer,
            state,
        );
        if (user_op_ret !== 0) {
            console.error(
                `failed to add user inscribe transfer op ${inscription_id} ${address} ${block_height}`,
            );
            return { ret: user_op_ret };
        }

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
     * @param {number} block_height
     * @param {number} timestamp
     * @param {string} txid
     * @param {string} to_address
     * @param {number} state
     * @returns {ret: number}
     */
    async update_transfer_record_on_transferred(
        inscription_id,
        from_address,

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
            typeof from_address === 'string',
            `from_address should be string`,
        );
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

        // first append user op
        assert(
            _.isString(this.config.token.account.exchange_address),
            `exchange_address should be string`,
        );
        let op;
        if (to_address === this.config.token.account.exchange_address) {
            op = UserOp.Exchange;
        } else {
            op = UserOp.Transfer;
        }

        const { ret: user_op_ret } = await this.ops_storage.add_user_op(
            from_address,
            inscription_id,
            block_height,
            timestamp,
            txid,
            op,
            state,
        );
        if (user_op_ret !== 0) {
            console.error(
                `failed to add user transfer op ${inscription_id} ${from_address} ${block_height}`,
            );
            return { ret: user_op_ret };
        }

        // then update the transfer_records
        return new Promise((resolve) => {
            this.db.run(
                `UPDATE transfer_records 
                    SET stage = ?,
                        block_height = ?, 
                        timestamp = ?, 
                        txid = ?, 
                        to_address = ?,
                        state = ?
                    WHERE inscription_id = ?`,
                [
                    InscriptionStage.Transfer,
                    block_height,
                    timestamp,
                    txid,
                    to_address,
                    state,
                    inscription_id,
                ],
                (err) => {
                    if (err) {
                        console.error(
                            `failed to update transfer record on transferred ${inscription_id} ${err}`,
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
     * @param {number} hash_point
     * @param {string} hash_weight
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
        hash_point,
        hash_weight,
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
        assert(Util.is_valid_and_strict_hex_mixhash(hash), `hash should be valid hex mixhash: ${hash}`);
        assert(typeof address === 'string', `address should be string`);
        assert(
            BigNumberUtil.is_positive_number_string(price),
            `price should be positive number string`,
        );
        assert(
            _.isNumber(hash_point),
            `hash_point should be number ${hash_point}`,
        );
        assert(
            BigNumberUtil.is_positive_number_string(hash_weight),
            `hash_weight should be positive number string`,
        );
        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer`,
        );

        // first append user op
        const { ret: user_op_ret } = await this.ops_storage.add_user_op(
            address,
            inscription_id,
            block_height,
            timestamp,
            txid,
            UserOp.SetPrice,
            state,
        );
        if (user_op_ret !== 0) {
            console.error(
                `failed to add user set price op ${inscription_id} ${address} ${block_height}`,
            );
            return { ret: user_op_ret };
        }

        // then append data op
        const { ret: data_op_ret } = await this.ops_storage.add_data_op(
            hash,
            inscription_id,
            block_height,
            timestamp,
            txid,
            address,
            price,
            UserOp.SetPrice,
            state,
        );
        if (data_op_ret !== 0) {
            console.error(
                `failed to add data op ${inscription_id} ${address} ${block_height}`,
            );
            return { ret: data_op_ret };
        }

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
                    hash_point,
                    hash_weight,
                    state
                ) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    inscription_id,
                    block_height,
                    timestamp,
                    txid,
                    content,
                    hash,
                    address,
                    price,
                    hash_point,
                    hash_weight,
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
     * @param {string} owner_bonus
     * @param {string} service_charge
     * @param {number} state
     * @returns {ret: number}
     */
    async add_resonance_record(
        inscription_id,
        block_height,
        timestamp,
        txid,
        address,
        hash,
        content,

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
            Number.isInteger(block_height) && block_height >= 0,
            `block_height should be non-negative integer`,
        );
        assert(Number.isInteger(timestamp), `timestamp should be integer`);
        assert(typeof txid === 'string', `txid should be string`);
        assert(typeof address === 'string', `address should be string`);
        assert(Util.is_valid_and_strict_hex_mixhash(hash), `hash should be valid hex mixhash: ${hash}`);
        assert(typeof content === 'string', `content should be string`);
        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer`,
        );

        assert(
            BigNumberUtil.is_positive_number_string(owner_bonus),
            `owner_bonus should be positive number string ${owner_bonus}`,
        );
        assert(
            BigNumberUtil.is_positive_number_string(service_charge),
            `service_charge should be positive number string ${service_charge}`,
        );
        assert(_.isNumber(state), `state should be number ${state}`);

        // first append user op
        const { ret: user_op_ret } = await this.ops_storage.add_user_op(
            address,
            inscription_id,
            block_height,
            timestamp,
            txid,
            UserOp.Resonance,
            state,
        );
        if (user_op_ret !== 0) {
            console.error(
                `failed to add user res op ${inscription_id} ${address} ${block_height}`,
            );
            return { ret: user_op_ret };
        }

        // then append data op
        const total_amount = BigNumberUtil.add(owner_bonus, service_charge);
        const { ret: data_op_ret } = await this.ops_storage.add_data_op(
            hash,
            inscription_id,
            block_height,
            timestamp,
            txid,
            address,
            BigNumberUtil.multiply(total_amount, '-1'),
            UserOp.Resonance,
            state,
        );
        if (data_op_ret !== 0) {
            console.error(
                `failed to add data op ${inscription_id} ${address} ${block_height}`,
            );
            return { ret: data_op_ret };
        }

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR REPLACE INTO resonance_records 
                (
                    inscription_id, 
 
                    block_height,
                    timestamp,
                    txid,
                    address,
                    hash,
                    content,

                    owner_bonus,
                    service_charge,

                    state
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    inscription_id,

                    block_height,
                    timestamp,
                    txid,
                    address,
                    hash,
                    content,

                    owner_bonus,
                    service_charge,

                    state,
                ],
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

    /**
     *
     * @param {string} inscription_id
     * @returns {ret: number, data: object | null}
     */
    async query_resonance_record(inscription_id) {
        assert(this.db != null, `db should not be null`);
        assert(typeof inscription_id === 'string', `should be string`);

        const sql = `
            SELECT * 
            FROM resonance_records 
            WHERE inscription_id = ?
            LIMIT 1
        `;

        return new Promise((resolve) => {
            this.db.get(sql, [inscription_id], (err, row) => {
                if (err) {
                    console.error(
                        `Could not query resonance ${inscription_id} ${err}`,
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

    // inscribe_data related methods
    /**
     *
     * @param {string} hash
     *
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
        inscription_id,
        address,
        block_height,
        timestamp,
        text,
        price,
        resonance_count,
    ) {
        assert(this.db != null, `db should not be null`);
        assert(Util.is_valid_and_strict_hex_mixhash(hash), `hash should be valid hex mixhash: ${hash}`);
        assert(
            typeof inscription_id === 'string',
            `inscription_id should be string`,
        );
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
                INSERT INTO inscribe_data (hash, inscription_id, address, block_height, timestamp, text, price, resonance_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

        return new Promise((resolve) => {
            this.db.run(
                sql,
                [
                    hash,
                    inscription_id,
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
        assert(Util.is_valid_and_strict_hex_mixhash(hash), `hash should be valid hex mixhash: ${hash}`);
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
        assert(Util.is_valid_and_strict_hex_mixhash(hash), `hash should be valid hex mixhash: ${hash}`);

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
     * @comment reset resonance count to new count
     * @param {string} hash
     * @param {number} count
     * @returns {ret: number}
     */
    async reset_resonance_count(hash, count) {
        assert(this.db != null, `db should not be null`);
        assert(Util.is_valid_and_strict_hex_mixhash(hash), `hash should be valid hex mixhash: ${hash}`);
        assert(_.isNumber(count), `count should be number ${count}`);
        assert(count <= 15, `count should <= 15 ${count}`);

        const sql = `
                UPDATE inscribe_data SET resonance_count = ? WHERE hash = ?
            `;

        return new Promise((resolve) => {
            this.db.run(sql, [count, hash], (err) => {
                if (err) {
                    console.error(
                        `Could not reset resonance count ${hash}`,
                        err,
                    );
                    resolve({ ret: -1 });
                } else if (this.changes === 0) {
                    console.error(
                        `Could not reset resonance count ${hash}, resonance not found!`,
                    );
                    resolve({ ret: 1 });
                } else {
                    console.log(`rest resonance count ${hash}, ${count}`);
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
        assert(Util.is_valid_and_strict_hex_mixhash(hash), `hash should be valid hex mixhash: ${hash}`);
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
                            `Could not update inscribe data owner ${hash} ${current_block_height} ${new_owner} ${new_block_height} ${new_timestamp}`,
                            err,
                        );
                        resolve({ ret: -1 });
                    } else if (this.changes === 0) {
                        console.error(
                            `Could not update inscribe data ${hash} owner to ${new_owner}, block_height is not match`,
                        );
                        resolve({ ret: 1 });
                    } else {
                        console.log(
                            `update inscribe data ${hash} owner to ${new_owner}`,
                        );
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
        assert(Util.is_valid_and_strict_hex_mixhash(hash), `hash should be valid hex mixhash: ${hash}`);

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
}

module.exports = { TokenIndexStorage, UserOp, UpdatePoolBalanceOp };
