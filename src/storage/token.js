const sqlite3 = require('sqlite3').verbose();
const assert = require('assert');
const path = require('path');
const {
    InscriptionStage,
    InscriptionOpState,
} = require('../token_index/ops/state');
const { BigNumberUtil } = require('../util');
const {
    TOKEN_INDEX_DB_FILE,
    TOKEN_MINT_POOL_INIT_AMOUNT,
    TOKEN_MINT_POOL_BURN_INIT_AMOUNT,
    TOKEN_MINT_POOL_VIRTUAL_ADDRESS,
    TOKEN_MINT_POOL_SERVICE_CHARGED_VIRTUAL_ADDRESS,
    TOKEN_MINT_POOL_LUCKY_MINT_VIRTUAL_ADDRESS,
    TOKEN_MINT_POOL_CHANT_VIRTUAL_ADDRESS,
    TOKEN_MINT_POOL_BURN_MINT_VIRTUAL_ADDRESS,
    TOKEN_MINT_POOL_BURN_MINT_INIT_VIRTUAL_ADDRESS,
} = require('../constants');
const { InscriptionOp } = require('../index/item');
const { UserHashRelationStorage } = require('./relation');
const { default: BigNumber } = require('bignumber.js');

// the ops that can update pool balance
const UpdatePoolBalanceOp = {
    Mint: 'mint',
    LuckyMint: 'lucky_mint',
    BurnMint: 'burn_mint',
    Chant: 'chant',
    InscribeData: 'inscribe_data',
};

// the user ops
const UserOp = {
    Mint: 'mint',

    InscribeData: 'inscribe_data',
    TransferData: 'transfer_data',

    Chant: 'chant',
    Resonance: 'res',

    InscribeTransfer: 'inscribe_transfer',
    Transfer: 'transfer',

    SetPrice: 'set_price',
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
        this.user_hash_relation_storage = new UserHashRelationStorage();
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

        const { ret: ret4 } = await this.user_hash_relation_storage.init(
            this.db,
        );
        if (ret4 !== 0) {
            console.error(`failed to init user hash relation storage`);
            return { ret: ret4 };
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

                // Create inscribe_data_pay_records table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS inscribe_data_pay_records (
                        inscription_id TEXT PRIMARY KEY,
                        stage STRING,

                        genesis_block_height INTEGER,
                        genesis_timestamp INTEGER,
                        genesis_txid TEXT,
                        from_address TEXT,
                        content TEXT,

                        hash TEXT,
                        mint_amount TEXT,
                        service_charge TEXT,
                        price TEXT,
                        hash_point INTEGER,
                        hash_weight TEXT,
                        
                        block_height INTEGER,
                        timestamp INTEGER,
                        txid TEXT,
                        to_address TEXT,

                        state INTEGER DEFAULT 0
                    )`,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to inscribe_data_pay_records table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(`created inscribe_data_pay_records table`);
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

        // init burn mint balance
        const { ret: ret5 } = await this._init_burn_mint_balance();
        if (ret5 !== 0) {
            console.error(`failed to init balance for burn mint pool`);
            return { ret: ret5 };
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
        assert(
            _.isNumber(mint_type),
            `mint_type should be string ${mint_type}`,
        );
        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer`,
        );

        // first append user op
        const { ret: user_op_ret } = await this.add_user_op(
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
     * @param {number} timestamp
     * @param {string} txid
     * @param {string} address
     * @param {string} content
     * @param {string} hash
     * @param {string} mint_amount
     * @param {string} service_charge
     * @param {string} price
     * @param {number} hash_point
     * @param {string} hash_weight
     * @param {number} state
     * @returns {ret: number}
     */
    async add_inscribe_data_pay_on_inscribed(
        inscription_id,
        block_height,
        timestamp,
        txid,
        address,
        content,

        hash,
        mint_amount,
        service_charge,
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
        assert(typeof address === 'string', `address should be string`);
        assert(typeof content === 'string', `content should be string`);
        assert(typeof hash === 'string', `hash should be string`);
        assert(
            BigNumberUtil.is_positive_number_string(mint_amount),
            `mint_amount should be positive number string`,
        );
        assert(
            BigNumberUtil.is_positive_number_string(service_charge),
            `service_charge should be positive number string`,
        );
        assert(
            BigNumberUtil.is_positive_number_string(price),
            `price should be positive number string`,
        );
        assert(
            Number.isInteger(hash_point) && hash_point >= 0,
            `hash_point should be non-negative integer`,
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
        const { ret: user_op_ret } = await this.add_user_op(
            address,
            inscription_id,
            block_height,
            timestamp,
            txid,
            UserOp.InscribeDataPay,
            state,
        );
        if (user_op_ret !== 0) {
            console.error(
                `failed to add user inscribe data pay op ${inscription_id} ${address} ${block_height}`,
            );
            return { ret: user_op_ret };
        }

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR REPLACE INTO inscribe_data_pay_records (
                    inscription_id, 
                    stage,

                    genesis_block_height,
                    genesis_timestamp,
                    genesis_txid,
                    from_address,
                    content,
        
                    hash,
                    mint_amount,
                    service_charge,
                    price,
                    hash_point,
                    hash_weight,

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

                    hash,
                    mint_amount,
                    service_charge,
                    price,
                    hash_point,
                    hash_weight,

                    0,
                    0,
                    null,
                    null,

                    state,
                ],
                (err) => {
                    if (err) {
                        console.error(
                            `failed to add inscribe data pay record on inscribed ${inscription_id} ${err}`,
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
    async add_inscribe_data_pay_record_on_transferred(
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
        const { ret: user_op_ret } = await this.add_user_op(
            from_address,
            inscription_id,
            block_height,
            timestamp,
            txid,
            UserOp.TransferDataPay,
            state,
        );
        if (user_op_ret !== 0) {
            console.error(
                `failed to add user transfer op ${inscription_id} ${from_address} ${block_height}`,
            );
            return { ret: user_op_ret };
        }

        // update the inscribe_data_pay_records
        return new Promise((resolve) => {
            this.db.run(
                `UPDATE inscribe_data_pay_records 
                    SET block_height = ?, 
                        timestamp = ?, 
                        txid = ?, 
                        to_address = ?,
                        state = ?
                    WHERE inscription_id = ?`,
                [
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
                            `failed to update inscribe data pay record on transferred ${inscription_id} ${err}`,
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
        const { ret: user_op_ret } = await this.add_user_op(
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
        assert(typeof hash === 'string', `should be string`);
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
        const { ret: user_op_ret } = await this.add_user_op(
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
            Number.isInteger(hash_point) && hash_point >= 0,
            `hash_point should be non-negative integer ${hash_point}`,
        );
        assert(
            BigNumberUtil.is_positive_number_string(hash_weight),
            `hash_weight should be non-negative number string ${hash_weight}`,
        );
        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer ${state}`,
        );

        // first append user op
        const { ret: user_op_ret } = await this.add_user_op(
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
                    state
                ) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        const { ret: user_op_ret } = await this.add_user_op(
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

        // first append user op
        const { ret: user_op_ret } = await this.add_user_op(
            from_address,
            inscription_id,
            block_height,
            timestamp,
            txid,
            UserOp.Transfer,
            state,
        );
        if (user_op_ret !== 0) {
            console.error(
                `failed to add user transfer op ${inscription_id} ${from_address} ${block_height}`,
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
        assert(typeof hash === 'string', `hash should be string`);
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
        const { ret: user_op_ret } = await this.add_user_op(
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
        assert(typeof hash === 'string', `hash should be string`);
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
        const { ret: user_op_ret } = await this.add_user_op(
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
                        console.error(
                            'failed to add resonance record',
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

    async _init_burn_mint_balance() {
        // run in transaction
        const { ret } = await this.begin_transaction();
        if (ret != 0) {
            console.error(`failed to begin transaction`);
            return { ret };
        }

        let process_result = 0;
        try {
            const { ret } = await this._init_burn_mint_balance_impl();
            process_result = ret;
        } catch (error) {
            console.error(
                `failed to init burn mint balance: ${error}, ${error.stack}`,
            );
            process_result = -1;
        } finally {
            const is_success = process_result === 0;

            const { ret: commit_ret } = await this.end_transaction(is_success);
            if (commit_ret !== 0) {
                console.error(
                    `failed to commit transaction for init burn mint balance`,
                );
                process_result = commit_ret;
            } else {
                console.log(
                    `finish init burn mint balance: ${TOKEN_MINT_POOL_BURN_INIT_AMOUNT}`,
                );
            }
        }

        return { ret: process_result };
    }

    async _init_burn_mint_balance_impl() {
        const { ret: get_ret, amount } = await this.get_balance(
            TOKEN_MINT_POOL_BURN_MINT_INIT_VIRTUAL_ADDRESS,
        );
        if (get_ret !== 0) {
            console.error(
                `failed to get balance for ${TOKEN_MINT_POOL_BURN_MINT_INIT_VIRTUAL_ADDRESS}`,
            );
            return { ret: get_ret };
        }

        const current_amount = new BigNumber(amount);
        const init_amount = new BigNumber(TOKEN_MINT_POOL_BURN_INIT_AMOUNT);
        if (current_amount.isEqualTo(init_amount)) {
            console.log(
                `burn mint balance already to update: ${TOKEN_MINT_POOL_BURN_INIT_AMOUNT}`,
            );
            return { ret: 0 };
        }

        // mint_pool_balance := mint_pool_balance + current_amount - init_amount
        const diff = current_amount.minus(init_amount);

        // update mint pool balance
        const { ret: update_ret } = await this.update_balance(
            TOKEN_MINT_POOL_VIRTUAL_ADDRESS,
            diff.toString(),
        );
        if (update_ret != 0) {
            console.error(
                `failed to update balance for mint pool with burn mint balance changed: ${current_amount.toString()} -> ${init_amount.toString()}`,
            );
            return { ret: update_ret };
        }

        // set burn mint balance
        const { ret: set_burn_ret } = await this.set_balance(
            TOKEN_MINT_POOL_BURN_MINT_INIT_VIRTUAL_ADDRESS,
            TOKEN_MINT_POOL_BURN_INIT_AMOUNT,
        );
        if (set_burn_ret != 0) {
            console.error(
                `failed to set burn mint balance: ${init_amount.toString()}`,
            );
            return { ret: set_burn_ret };
        }

        return { ret: 0 };
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
                            `Could not update pool balance on mint ${TOKEN_MINT_POOL_VIRTUAL_ADDRESS} ${amount}`,
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
                            `Could not update lucky mint balance ${TOKEN_MINT_POOL_LUCKY_MINT_VIRTUAL_ADDRESS} ${amount}`,
                        );
                        return { ret };
                    }

                    const { ret: update_ret } = await this.update_balance(
                        TOKEN_MINT_POOL_VIRTUAL_ADDRESS,
                        BigNumberUtil.multiply(amount, -1),
                    );
                    if (update_ret != 0) {
                        console.error(
                            `Could not update pool balance on lucky mint ${TOKEN_MINT_POOL_VIRTUAL_ADDRESS} ${amount}`,
                        );
                        return { ret: update_ret };
                    }
                }

                break;
            case UpdatePoolBalanceOp.BurnMint: {
                {
                    const { ret } = await this.update_balance(
                        TOKEN_MINT_POOL_BURN_MINT_VIRTUAL_ADDRESS,
                        amount,
                    );
                    if (ret != 0) {
                        console.error(
                            `Could not update burn mint balance ${TOKEN_MINT_POOL_BURN_MINT_VIRTUAL_ADDRESS} ${amount}`,
                        );
                        return { ret };
                    }
                }

                break;
            }
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
        assert(typeof hash === 'string', `hash should be string`);
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
     * @comment reset resonance count to new count
     * @param {string} hash
     * @param {number} count
     * @returns {ret: number}
     */
    async reset_resonance_count(hash, count) {
        assert(this.db != null, `db should not be null`);
        assert(typeof hash === 'string', `hash should be string`);
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
                            `append user op ${address} ${inscription_id} ${block_height} ${op}`,
                        );
                        resolve({ ret: 0 });
                    }
                },
            );
        });
    }

    /**
     *
     * @param {string} address
     * @returns {ret: number, txid: string | null}
     */
    async query_user_last_mint_and_inscribe_data_ops_txid(address) {
        assert(this.db != null, `db should not be null`);
        assert(typeof address === 'string', `address should be string`);

        const sql = `
            SELECT txid FROM user_ops WHERE address = ? AND (op = ? OR op = ?) ORDER BY block_height DESC LIMIT 1
        `;

        return new Promise((resolve) => {
            this.db.get(
                sql,
                [address, UserOp.Mint, UserOp.InscribeData],
                (err, row) => {
                    if (err) {
                        console.error(
                            `Could not query user last mint and inscribe data ops ${address}`,
                            err,
                        );
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0, txid: row ? row.txid : null });
                    }
                },
            );
        });
    }
}

module.exports = { UpdatePoolBalanceOp, TokenIndexStorage, UserOp };
