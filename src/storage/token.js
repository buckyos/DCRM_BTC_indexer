const sqlite3 = require('sqlite3').verbose();
const assert = require('assert');
const path = require('path');
const { InscriptionStage } = require('../index/ops/state');
const { BigNumberUtil } = require('../util');

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
                        content TEXT,   
                        amount TEXT,
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

                // Create chant_records table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS chant_records (
                        inscription_id TEXT PRIMARY KEY,
                        block_height INTEGER,
                        timestamp INTEGER,
                        address TEXT,
                        content TEXT,
                        hash TEXT,
                        user_bouns TEXT,
                        owner_bouns TEXT,
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

                // create index for hash and address field on chant_records table
                this.db.exec(
                    `CREATE INDEX IF NOT EXISTS idx_chant_records_hash ON chant_records (hash);
                     CREATE INDEX IF NOT EXISTS idx_chant_records_address ON chant_records (address);
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

                // Create set_price_records table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS set_price_records (
                        inscription_id TEXT PRIMARY KEY,
                        block_height INTEGER,
                        timestamp INTEGER,
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

                        owner_bouns TEXT,
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

    /**
     *
     * @param {string} inscription_id
     * @param {number} block_height
     * @param {number} timestamp
     * @param {string} address
     * @param {string} content
     * @param {string} amount
     * @param {string} lucky
     * @returns {ret: number}
     */
    async add_mint_record(
        inscription_id,
        block_height,
        timestamp,
        address,
        content,
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
        assert(typeof content === 'string', `content should be string`);
        assert(
            BigNumberUtil.is_positive_number_string(amount),
            `amount should be positive number string`,
        );
        assert(typeof lucky === 'string', `lucky should be string`);

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO mint_records (
                    inscription_id, 
                    block_height, 
                    timestamp, 
                    address, 
                    content, 
                    amount, 
                    lucky
                ) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    inscription_id,
                    block_height,
                    timestamp,
                    address,
                    content,
                    amount,
                    lucky,
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

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO inscribe_records 
                    (inscription_id, 
                    block_height, 
                    address, 
                    timestamp, 
                    hash, 
                    content,
                    mint_amount, 
                    service_charge, 
                    text, 
                    price, 
                    state) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    inscription_id,
                    block_height,
                    address,
                    timestamp,
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
     * @param {string} address
     * @param {string} content
     * @param {string} hash
     * @param {string} user_bouns
     * @param {string} owner_bouns
     * @param {number} state
     * @returns
     */
    async add_chant_record(
        inscription_id,
        block_height,
        timestamp,
        address,
        content,
        hash,
        user_bouns,
        owner_bouns,
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
        assert(typeof content === 'string', `content should be string`);
        assert(typeof hash === 'string', `hash should be string`);
        assert(
            BigNumberUtil.is_positive_number_string(user_bouns),
            `user_bouns should be positive number string`,
        );
        assert(
            BigNumberUtil.is_positive_number_string(owner_bouns),
            `owner_bouns should be positive number string`,
        );
        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer`,
        );

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO chant_records (
                    inscription_id, 
                    block_height, 
                    timestamp, 
                    address,
                    content,
                    hash, 
                    user_bouns, 
                    owner_bouns, 
                    state
                ) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    inscription_id,
                    block_height,
                    timestamp,
                    address,
                    content,
                    hash,
                    user_bouns,
                    owner_bouns,
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

        return new Promise((resolve, reject) => {
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
    async add_transfer_record_on_transfered(
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

        return new Promise((resolve, reject) => {
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
        assert(typeof inscription_id === 'string', `should be string`);
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

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO set_price_records (
                    inscription_id, 
                    block_height, 
                    timestamp, 
                    content,
                    hash, 
                    address, 
                    price, 
                    state
                ) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    inscription_id,
                    block_height,
                    timestamp,
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

                    owner_bouns,
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
     * @param {string} owner_bouns
     * @param {string} service_charge
     * @param {number} state
     * @returns {ret: number}
     */
    async add_resonance_record_on_transfered(
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

        owner_bouns,
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
            BigNumberUtil.is_positive_number_string(owner_bouns),
            `owner_bouns should be positive number string ${owner_bouns}`,
        );
        assert(
            BigNumberUtil.is_positive_number_string(service_charge),
            `service_charge should be positive number string ${service_charge}`,
        );

        assert(
            Number.isInteger(state) && state >= 0,
            `state should be non-negative integer`,
        );

        return new Promise((resolve, reject) => {
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

                    owner_bouns,
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

                    owner_bouns,
                    service_charge,

                    state,
                ],
                (err) => {
                    if (err) {
                        console.error(
                            `failed to add resonance transfered record: ${inscription_id} ${err}`,
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

        return new Promise((resolve, reject) => {
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
     *
     * @param {string} address
     * @param {string} amount
     * @returns {ret: number}
     */
    async add_balance(address, amount) {
        assert(this.db != null, `db should not be null`);
        assert(typeof address === 'string', `address should be string`);
        assert(
            BigNumberUtil.is_number_string(str),
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

    // balance table methods
    /**
     *
     * @param {string} address
     * @param {string} amount
     * @returns
     */
    async update_balance(address, amount) {
        assert(this.db != null, `db should not be null`);
        assert(typeof address === 'string', `address should be string`);
        assert(
            BigNumberUtil.is_number_string(amount),
            `amount should be valid number string: ${amount}`,
        );

        return new Promise((resolve) => {
            db.get(
                'SELECT amount FROM balance WHERE address = ?',
                [address],
                (err, row) => {
                    if (err) {
                        console.error(
                            `Could not get balance for address ${address}, ${err}`,
                        );
                        resolve({ ret: -1 });
                    } else if (row) {
                        const new_amount = BigNumberUtil.add(
                            row.amount,
                            amount,
                        );
                        db.run(
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
                                        `updated balance for address ${address} to ${new_amount}`,
                                    );
                                    resolve({ ret: 0 });
                                }
                            },
                        );
                    } else {
                        console.error(
                            `Could not find balance for address ${address}`,
                        );
                        resolve({ ret: -1 });
                    }
                },
            );
        });
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

        return new Promise((resolve, reject) => {
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
     *
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
            return { ret: -1 };
        }

        if (BigNumberUtil.compare(from_balance, amount) < 0) {
            console.error(
                `Insufficient balance ${from_address} : ${from_balance} < ${amount}`,
            );
            return { ret: -1 };
        }

        const { ret: update_from_balance_ret } = await this.update_balance(
            from_address,
            BigNumberUtil.multiply(amount, -1),
        );
        if (update_from_balance_ret != 0) {
            console.error(`Could not update balance ${from_address}`);
            return { ret: -1 };
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
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

        return new Promise((resolve, reject) => {
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
}

module.exports = { TokenIndexStorage };
