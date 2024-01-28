const sqlite3 = require('sqlite3').verbose();
const assert = require('assert');
const { InscriptionOpState } = require('../token_index/ops/state');
const { BigNumberUtil } = require('../util');
const {
    TOKEN_MINT_POOL_INIT_AMOUNT,
    TOKEN_MINT_POOL_BURN_INIT_AMOUNT,
    TOKEN_MINT_POOL_VIRTUAL_ADDRESS,
    TOKEN_MINT_POOL_SERVICE_CHARGED_VIRTUAL_ADDRESS,
    TOKEN_MINT_POOL_LUCKY_MINT_VIRTUAL_ADDRESS,
    TOKEN_MINT_POOL_CHANT_VIRTUAL_ADDRESS,
    TOKEN_MINT_POOL_BURN_MINT_VIRTUAL_ADDRESS,
    TOKEN_MINT_POOL_BURN_MINT_INIT_VIRTUAL_ADDRESS,
} = require('../constants');
const { default: BigNumber } = require('bignumber.js');

// the ops that can update pool balance
const UpdatePoolBalanceOp = {
    Mint: 'mint',
    LuckyMint: 'lucky_mint',
    BurnMint: 'burn_mint',
    Chant: 'chant',
    InscribeData: 'inscribe_data',
    Resonance: 'resonance',
};

// the token type, default is brc-20 token, inner is inner token
const BalanceRecordTokenType = {
    Default: 0,
    Inner: 1,
};

class TokenBalanceStorage {
    constructor(owner, config) {
        assert(owner != null, `owner should not be null`);
        assert(config != null, `config should not be null`);

        this.owner = owner;
        this.config = config;
        this.db = null;
    }

    /**
     * @param {sqlite3.Database} db
     * @returns {ret: number}
     */
    async init(db) {
        assert(db instanceof sqlite3.Database, `db should be sqlite3.Database`);
        assert(this.db == null, `db should be null`);
        this.db = db;

        // first init tables
        const { ret } = await this._init_tables();
        if (ret !== 0) {
            console.error(`failed to init balance storage tables`);
            return { ret };
        }

        // then init data
        const { ret: ret2 } = await this._init_data();
        if (ret2 !== 0) {
            console.error(`failed to init balance storage data`);
            return { ret: ret2 };
        }

        // then init coinbase
        const { ret: ret3 } = await this._init_coinbase();
        if (ret3 !== 0) {
            console.error(`failed to init balance storage coinbase`);
            return { ret: ret3 };
        }

        console.log(`init balance storage success`);

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

                // Create balance table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS balance (
                        address TEXT PRIMARY KEY,

                        /* for DMCs token, which is the standard brc-20 token*/
                        amount TEXT,
                        transferable_amount TEXT,

                        /* for DMCi inner token */
                        inner_amount TEXT,
                        inner_transferable_amount TEXT
                    );`,
                    (err) => {
                        if (err) {
                            console.error(`failed to balance table: ${err}`);
                            has_error = true;
                            resolve({ ret: -1 });
                            return;
                        }

                        console.log(`created balance table`);
                    },
                );

                if (has_error) {
                    return;
                }

                // create balance record table
                this.db.exec(
                    `CREATE TABLE IF NOT EXISTS balance_records (
                        address_sequence INTEGER,
                        inscription_id TEXT,
                        address TEXT,
                    
                        token_type INTEGER,
                        change_amount TEXT,
                        balance TEXT,
                        
                        block_height INTEGER,
                        timestamp INTEGER,
                        
                        op_type TEXT,
                        PRIMARY KEY (address_sequence, address)
                    );
                      
                    CREATE TABLE IF NOT EXISTS address_sequence (
                        address TEXT PRIMARY KEY,
                        sequence INTEGER NOT NULL
                    );
                    `,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to balance record table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                            return;
                        }

                        console.log(`created balance record table`);
                    },
                );

                // create index for balance record table
                if (has_error) {
                    return;
                }

                this.db.exec(
                    `CREATE INDEX IF NOT EXISTS balance_records_inscription_id_index ON balance_records (address);`,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to create index for balance record table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                            return;
                        }

                        console.log(`created index for balance record table`);
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

        let max_mint_amount = TOKEN_MINT_POOL_INIT_AMOUNT;
        if (_.isString(this.config.token.max_mint_amount)) {
            max_mint_amount = this.config.token.max_mint_amount;
        }

        const { ret } = await this.init_balance(
            TOKEN_MINT_POOL_VIRTUAL_ADDRESS,
            '0',
            max_mint_amount,
        );

        if (ret !== 0) {
            console.error(`failed to init balance for mint pool`);
            return { ret };
        }

        const { ret: ret2 } = await this.init_balance(
            TOKEN_MINT_POOL_SERVICE_CHARGED_VIRTUAL_ADDRESS,
            '0',
            '0',
        );
        if (ret2 !== 0) {
            console.error(`failed to init balance for mint pool charged`);
            return { ret: ret2 };
        }

        const { ret: ret3 } = await this.init_balance(
            TOKEN_MINT_POOL_LUCKY_MINT_VIRTUAL_ADDRESS,
            '0',
            '0',
        );
        if (ret3 !== 0) {
            console.error(`failed to init balance for mint pool lucky mint`);
            return { ret: ret3 };
        }

        const { ret: ret4 } = await this.init_balance(
            TOKEN_MINT_POOL_CHANT_VIRTUAL_ADDRESS,
            '0',
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
     * @comment init coinbase balance in config
     * @returns {ret: number}
     */
    async _init_coinbase() {
        assert(this.db != null, `db should not be null`);

        if (this.config.token.coinbase != null) {
            assert(
                _.isArray(this.config.token.coinbase),
                `coinbase should be array: ${this.config.token.coinbase}`,
            );
            for (const item of this.config.token.coinbase) {
                assert(
                    _.isObject(item),
                    `coinbase item should be object: ${item}`,
                );
                assert(
                    _.isString(item.address),
                    `coinbase item address should be string: ${item.address}`,
                );
                assert(
                    _.isString(item.amount),
                    `coinbase item amount should be string: ${item.amount}`,
                );
                assert(
                    _.isString(item.inner_amount),
                    `coinbase item inner_amount should be string: ${item.inner_amount}`,
                );

                const { ret, is_first } = await this.init_balance(
                    item.address,
                    item.amount,
                    item.inner_amount,
                );
                if (ret !== 0) {
                    console.error(
                        `failed to init coinbase balance for coinbase`,
                    );
                    return { ret };
                }

                // add coinbase balance record
                if (is_first) {
                    if (BigNumberUtil.compare(item.amount, '0') > 0) {
                        const { ret } = await this.add_balance_record(
                            '',
                            item.address,
                            item.amount,
                            item.amount,
                            0,
                            0,
                            'coinbase',
                        );
                        if (ret !== 0) {
                            console.error(
                                `failed to add coinbase balance record for ${item.address}`,
                            );
                            return { ret };
                        }
                    }

                    if (BigNumberUtil.compare(item.inner_amount, '0') > 0) {
                        const { ret } = await this.add_inner_balance_record(
                            '',
                            item.address,
                            item.inner_amount,
                            item.inner_amount,
                            0,
                            0,
                            'coinbase',
                        );
                        if (ret !== 0) {
                            console.error(
                                `failed to add coinbase balance record for ${item.address}`,
                            );
                            return { ret };
                        }
                    }
                }

                console.log(
                    `init coinbase balance for ${item.address} ${item.amount} ${item.inner_amount}`,
                );
            }
        }

        return { ret: 0 };
    }
    /**
     * @comment set the init balance for address, if address exists, do nothing
     * @param {string} address
     * @param {string} amount
     * @returns {ret: number, is_first: boolean}
     */
    async init_balance(address, amount, inner_amount) {
        assert(this.db != null, `db should not be null`);
        assert(typeof address === 'string', `address should be string`);
        assert(
            BigNumberUtil.is_positive_number_string(amount),
            `amount should be valid number string: ${amount}`,
        );

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR IGNORE INTO balance (
                    address, 
                    amount, 
                    transferable_amount, 
                    inner_amount,
                    inner_transferable_amount
                ) VALUES (?, ?, ?, ?, ?)`,
                [address, amount, '0', inner_amount, '0'],
                function (err) {
                    if (err) {
                        console.error(
                            `failed to init balance for ${address}`,
                            err,
                        );
                        resolve({ ret: -1 });
                    } else {
                        if (this.changes > 0) {
                            console.log(
                                `first init coinbase balance for ${address} ${amount} ${inner_amount}`,
                            );

                            resolve({ ret: 0, is_first: true });
                        } else {
                            resolve({ ret: 0, is_first: false });
                        }
                    }
                },
            );
        });
    }

    async _init_burn_mint_balance() {
        // run in transaction
        const { ret } = await this.owner.begin_transaction();
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

            const { ret: commit_ret } = await this.owner.end_transaction(
                is_success,
            );
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
        const { ret: get_ret, amount: balance } = await this.get_inner_balance(
            TOKEN_MINT_POOL_BURN_MINT_INIT_VIRTUAL_ADDRESS,
        );
        if (get_ret !== 0) {
            console.error(
                `failed to get balance for ${TOKEN_MINT_POOL_BURN_MINT_INIT_VIRTUAL_ADDRESS}`,
            );
            return { ret: get_ret };
        }

        assert(balance != null, `balance should not be null`);
        assert(
            _.isString(balance),
            `inner_amount should be string: ${balance}`,
        );

        const current_amount = new BigNumber(balance);
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
        const { ret: update_ret } = await this.update_inner_balance(
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
        const { ret: set_burn_ret } = await this._set_inner_balance(
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
     * @comment reset the balance for address, if address exists, update it
     * @param {string} address
     * @param {object} balance
     * @returns {ret: number}
     */
    async set_all_balance(address, balance) {
        assert(this.db != null, `db should not be null`);
        assert(typeof address === 'string', `address should be string`);
        assert(balance != null, `balance should not be null`);
        assert(_.isObject(balance), `balance should be object`);
        assert(
            BigNumberUtil.is_positive_number_string(balance.amount),
            `amount should be valid number string: ${balance.amount}`,
        );
        assert(
            BigNumberUtil.is_positive_number_string(
                balance.transferable_amount,
            ),
            `transferable_amount should be valid number string: ${balance.transferable_amount}`,
        );
        assert(
            BigNumberUtil.is_positive_number_string(balance.inner_amount),
            `inner_amount should be valid number string: ${balance.inner_amount}`,
        );
        assert(
            BigNumberUtil.is_positive_number_string(
                balance.inner_transferable_amount,
            ),
            `inner_transferable_amount should be valid number string: ${balance.inner_transferable_amount}`,
        );

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR REPLACE INTO balance 
                    (address, 
                    amount,
                    transferable_amount,
                    inner_amount,
                    inner_transferable_amount
                 )
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    address,
                    balance.amount,
                    balance.transferable_amount,
                    balance.inner_amount,
                    balance.inner_transferable_amount,
                ],
                (err) => {
                    if (err) {
                        console.error('failed to set all balance', err);
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0 });
                    }
                },
            );
        });
    }

    /**
     * @comment set the inner token's balance for address, if address exists, update it
     * @param {string} address
     * @param {string} amount
     * @returns {ret: number}
     */
    async _set_inner_balance(address, amount) {
        return await this._set_balance(address, 'inner_amount', amount);
    }

    /**
     * @comment set the balance for address, if address exists, update it
     * @param {string} address
     * @param {string} amount
     * @returns {ret: number}
     */
    async _set_balance(address, field, amount) {
        assert(this.db != null, `db should not be null`);
        assert(typeof address === 'string', `address should be string`);
        assert(typeof field === 'string', `field should be string`);
        assert(
            BigNumberUtil.is_positive_number_string(amount),
            `amount should be valid number string: ${amount}`,
        );

        let a1, a2;
        if (field === 'amount') {
            a1 = amount;
            a2 = '0';
        } else {
            assert(field === 'inner_amount');
            a1 = '0';
            a2 = amount;
        }

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR REPLACE INTO balance 
                    (address, 
                    amount,
                    transferable_amount,
                    inner_amount,
                    inner_transferable_amount
                 )
                 VALUES (?, ?, ?, ?, ?)`,
                [address, a1, '0', a2, '0'],
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
     * @comment update brc-20 token's balance for address, return InscriptionOpState.INSUFFICIENT_BALANCE if balance is not enough, return -1 on error, return 0 on success
     * @param {string} address
     * @param {string} amount
     * @returns {ret: number}
     */
    async update_balance(address, amount) {
        return await this._update_balance(address, 'amount', amount);
    }

    /**
     * @comment update inner token's balance for address, return InscriptionOpState.INSUFFICIENT_BALANCE if balance is not enough, return -1 on error, return 0 on success
     * @param {string} address
     * @param {string} amount
     * @returns {ret: number}
     */
    async update_inner_balance(address, amount) {
        return await this._update_balance(address, 'inner_amount', amount);
    }

    /**
     * @comment update balance for address, return InscriptionOpState.INSUFFICIENT_BALANCE if balance is not enough, return -1 on error, return 0 on success
     * @param {string} address
     * @param {string} amount
     * @returns {ret: number}
     */
    async _update_balance(address, field, amount) {
        assert(this.db != null, `db should not be null`);
        assert(typeof address === 'string', `address should be string`);
        assert(typeof field === 'string', `field should be string`);
        assert(
            BigNumberUtil.is_number_string(amount),
            `amount should be valid number string: ${amount}`,
        );

        return new Promise((resolve) => {
            this.db.get(
                `SELECT ${field} FROM balance WHERE address = ?`,
                [address],
                (err, row) => {
                    if (err) {
                        console.error(
                            `Could not get ${field} balance for address ${address}, ${err}`,
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

                            let a1, a2;
                            if (field === 'amount') {
                                a1 = amount;
                                a2 = '0';
                            } else {
                                assert(field === 'inner_amount');
                                a1 = '0';
                                a2 = amount;
                            }

                            this.db.run(
                                `INSERT INTO balance (
                                    address,
                                    amount, 
                                    transferable_amount, 
                                    inner_amount,
                                    inner_transferable_amount
                                ) 
                                VALUES (?, ?, ?, ?, ?)
                                `,
                                [address, a1, '0', a2, '0'],
                                (err) => {
                                    if (err) {
                                        console.error(
                                            `Could not insert ${field} balance for address ${address}, ${err}`,
                                        );
                                        resolve({ ret: -1 });
                                    } else {
                                        console.log(
                                            `first inserted ${field} balance for address ${address} ${amount}`,
                                        );
                                        resolve({ ret: 0 });
                                    }
                                },
                            );
                        } else {
                            const current_amount = row[field];
                            const new_amount = BigNumberUtil.add(
                                current_amount,
                                amount,
                            );

                            // new_amount should >= 0
                            if (BigNumberUtil.compare(new_amount, '0') < 0) {
                                console.warn(
                                    `new amount ${new_amount} is negative, current amount ${current_amount}, amount ${amount}`,
                                );
                                resolve({
                                    ret: InscriptionOpState.INSUFFICIENT_BALANCE,
                                });
                                return;
                            }

                            this.db.run(
                                `UPDATE balance SET ${field} = ? WHERE address = ?`,
                                [new_amount, address],
                                (err) => {
                                    if (err) {
                                        console.error(
                                            `Could not update ${field} balance for address ${address}, ${err}`,
                                        );
                                        resolve({ ret: -1 });
                                    } else {
                                        console.log(
                                            `updated ${field} balance for address ${address} ${amount} ${current_amount} -> ${new_amount}`,
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
     * @comment update transferable balance for address, return InscriptionOpState.INSUFFICIENT_BALANCE if balance is not enough, return -1 on error, return 0 on success
     * @param {string} address
     * @param {string} amount
     * @returns {ret: number}
     */
    async update_transferable_balance(address, amount) {
        return await this._update_transferable_balance(
            address,
            'amount',
            amount,
        );
    }

    /**
     * @comment update inner transferable balance for address, return InscriptionOpState.INSUFFICIENT_BALANCE if balance is not enough, return -1 on error, return 0 on success
     * @param {string} address
     * @param {string} amount
     * @returns {ret: number}
     */
    async update_inner_transferable_balance(address, amount) {
        return await this._update_transferable_balance(
            address,
            'inner_amount',
            amount,
        );
    }

    /**
     * @comment update transferable balance for address, return InscriptionOpState.INSUFFICIENT_BALANCE if balance is not enough, return -1 on error, return 0 on success
     * @param {string} address
     * @param {string} field, amount or inner_amount
     * @param {string} amount, can be negative
     * @returns {ret: number}
     */
    async _update_transferable_balance(address, field, amount) {
        assert(this.db != null, `db should not be null`);
        assert(typeof address === 'string', `address should be string`);
        assert(typeof field === 'string', `field should be string`);
        assert(
            BigNumberUtil.is_number_string(amount),
            `amount should be valid number string: ${amount}`,
        );

        let transferable_amount_field;
        if (field === 'amount') {
            transferable_amount_field = 'transferable_amount';
        } else {
            assert(field === 'inner_amount');
            transferable_amount_field = 'inner_transferable_amount';
        }

        return new Promise((resolve) => {
            this.db.get(
                `SELECT * FROM balance WHERE address = ?`,
                [address],
                (err, row) => {
                    if (err) {
                        console.error(
                            `Could not get balance for address ${address}, ${err}`,
                        );
                        resolve({ ret: -1 });
                    } else {
                        if (row == null) {
                            // the balance not exists, so the transferable must be failed
                            console.warn(
                                `balance not exists for address ${address}`,
                            );
                            resolve({
                                ret: InscriptionOpState.INSUFFICIENT_BALANCE,
                            });
                        } else {
                            // first check the transferable amount
                            const current_transferable_amount =
                                row[transferable_amount_field];
                            let new_transferable_amount = BigNumberUtil.add(
                                current_transferable_amount,
                                amount,
                            );

                            // total's new_amount should >= 0
                            if (
                                BigNumberUtil.compare(
                                    new_transferable_amount,
                                    '0',
                                ) < 0
                            ) {
                                // should not happen
                                console.error(
                                    `new transferable amount ${new_transferable_amount} is negative, current transferable amount ${current_transferable_amount}, amount ${amount}`,
                                );

                                resolve({
                                    ret: InscriptionOpState.INSUFFICIENT_BALANCE,
                                });
                                return;
                            }

                            this.db.run(
                                `UPDATE balance SET ${transferable_amount_field} = ? WHERE address = ?`,
                                [new_transferable_amount, address],
                                (err) => {
                                    if (err) {
                                        console.error(
                                            `Could not update ${field} transferable balance for address ${address}, ${err}`,
                                        );
                                        resolve({ ret: -1 });
                                    } else {
                                        console.log(
                                            `updated ${field} transferable balance for address ${address} ${current_transferable_amount} -> ${new_transferable_amount}`,
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
     * @param {string} inner_amount
     * @returns {ret: number}
     */
    async update_pool_balance_on_ops(op, amount, inner_amount, service_charge = '0') {
        assert(this.db != null, `db should not be null`);
        assert(
            BigNumberUtil.is_positive_number_string(amount),
            `amount should be >= 0 number string: ${amount}`,
        );
        assert(
            BigNumberUtil.is_positive_number_string(inner_amount),
            `inner_amount should be >= 0 number string: ${inner_amount}`,
        );
        assert(
            BigNumberUtil.is_positive_number_string(service_charge),
            `service_charge should be number string: ${service_charge}`,
        );

        switch (op) {
            case UpdatePoolBalanceOp.Mint:
                {
                    const total = BigNumberUtil.add(amount, inner_amount);

                    const { ret: update_ret } = await this.update_inner_balance(
                        TOKEN_MINT_POOL_VIRTUAL_ADDRESS,
                        BigNumberUtil.multiply(total, -1),
                    );
                    if (update_ret != 0) {
                        console.error(
                            `Could not update pool balance on mint ${TOKEN_MINT_POOL_VIRTUAL_ADDRESS} ${total}`,
                        );
                        return { ret: update_ret };
                    }
                }

                break;
            case UpdatePoolBalanceOp.LuckyMint:
                {
                    const total = BigNumberUtil.add(amount, inner_amount);

                    // first stat all amount to lucky mint
                    const { ret } = await this.update_inner_balance(
                        TOKEN_MINT_POOL_LUCKY_MINT_VIRTUAL_ADDRESS,
                        total,
                    );
                    if (ret != 0) {
                        console.error(
                            `Could not update lucky mint balance ${TOKEN_MINT_POOL_LUCKY_MINT_VIRTUAL_ADDRESS} ${total}`,
                        );
                        return { ret };
                    }

                    // then subtract the total amount from mint pool
                    const { ret: update_ret } = await this.update_inner_balance(
                        TOKEN_MINT_POOL_VIRTUAL_ADDRESS,
                        BigNumberUtil.multiply(total, -1),
                    );
                    if (update_ret != 0) {
                        console.error(
                            `Could not update pool balance on lucky mint ${TOKEN_MINT_POOL_VIRTUAL_ADDRESS} ${total}`,
                        );
                        return { ret: update_ret };
                    }
                }

                break;
            case UpdatePoolBalanceOp.BurnMint: {
                {
                    const total = BigNumberUtil.add(amount, inner_amount);

                    // first stat all amount to burn mint
                    const { ret } = await this.update_inner_balance(
                        TOKEN_MINT_POOL_BURN_MINT_VIRTUAL_ADDRESS,
                        total,
                    );
                    if (ret != 0) {
                        console.error(
                            `Could not update burn mint balance ${TOKEN_MINT_POOL_BURN_MINT_VIRTUAL_ADDRESS} ${amount}`,
                        );
                        return { ret };
                    }

                    // then subtract the amount from mint pool
                    const { ret: update_ret } = await this.update_inner_balance(
                        TOKEN_MINT_POOL_VIRTUAL_ADDRESS,
                        BigNumberUtil.multiply(amount, -1),
                    );
                    if (update_ret != 0) {
                        console.error(
                            `Could not update pool balance on burn mint ${TOKEN_MINT_POOL_VIRTUAL_ADDRESS} ${amount}`,
                        );
                        return { ret: update_ret };
                    }
                }

                break;
            }
            case UpdatePoolBalanceOp.Chant:
                {
                    assert(
                        amount === '0',
                        `amount should be 0 on chant: ${amount}`,
                    );

                    const { ret } = await this.update_inner_balance(
                        TOKEN_MINT_POOL_CHANT_VIRTUAL_ADDRESS,
                        amount,
                    );
                    if (ret != 0) {
                        console.error(
                            `Could not update chant balance ${TOKEN_MINT_POOL_LUCKY_MINT_VIRTUAL_ADDRESS}`,
                        );
                        return { ret };
                    }

                    const { ret: update_ret } = await this.update_inner_balance(
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
                    assert(
                        amount === '0',
                        `amount should be 0 on inscribe data: ${amount}`,
                    );

                    const { ret } = await this.update_inner_balance(
                        TOKEN_MINT_POOL_SERVICE_CHARGED_VIRTUAL_ADDRESS,
                        service_charge,
                    );
                    if (ret != 0) {
                        assert(ret < 0);
                        console.error(
                            `Could not update inscribe data service charge balance ${TOKEN_MINT_POOL_SERVICE_CHARGED_VIRTUAL_ADDRESS}`,
                        );
                        return { ret };
                    }

                    // refound inner_amount to mint pool
                    const { ret: update_ret } = await this.update_inner_balance(
                        TOKEN_MINT_POOL_VIRTUAL_ADDRESS,
                        inner_amount,
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

            case UpdatePoolBalanceOp.Resonance:
                {
                    assert(
                        amount === '0',
                        `amount should be 0 on resonance: ${amount}`,
                    );
                    assert(
                        inner_amount === '0',
                        `inner_amount should be 0 on resonance: ${inner_amount}`,
                    );

                    const { ret } = await this.update_inner_balance(
                        TOKEN_MINT_POOL_SERVICE_CHARGED_VIRTUAL_ADDRESS,
                        service_charge,
                    );
                    if (ret != 0) {
                        assert(ret < 0);
                        console.error(
                            `Could not update resonance service charge balance ${TOKEN_MINT_POOL_SERVICE_CHARGED_VIRTUAL_ADDRESS}`,
                        );
                        return { ret };
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

    _empty_balance() {
        return {
            amount: '0',
            transferable_amount: '0',
            inner_amount: '0',
            inner_transferable_amount: '0',
        };
    }

    /**
     *
     * @param {string} address
     * @returns {ret: number, balance: object}
     */
    async get_all_balance(address) {
        const sql = `
            SELECT * FROM balance WHERE address = ?
        `;

        return new Promise((resolve) => {
            this.db.get(sql, [address], (err, row) => {
                if (err) {
                    console.error('Could not get balance', err);
                    resolve({ ret: -1 });
                } else {
                    resolve({
                        ret: 0,
                        value: row ? row : this._empty_balance(),
                    });
                }
            });
        });
    }

    /**
     * @comment get brc-20 token's balance for address
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
                    resolve({
                        ret: 0,
                        amount: row ? row.amount : '0',
                    });
                }
            });
        });
    }

    /**
     * @comment get available brc-20 token's balance for address
     * @param {string} address
     * @returns {ret: number, amount: string}
     */
    async get_available_balance(address) {
        const sql = `
            SELECT amount, transferable_amount FROM balance WHERE address = ?
        `;

        return new Promise((resolve) => {
            this.db.get(sql, [address], (err, row) => {
                if (err) {
                    console.error('Could not get balance', err);
                    resolve({ ret: -1 });
                } else {
                    let amount = '0';
                    if (row) {
                        amount = BigNumberUtil.subtract(
                            row.amount,
                            row.transferable_amount,
                        );
                        assert(
                            BigNumberUtil.is_positive_number_string(amount),
                            `amount should be positive number string: ${amount}`,
                        );
                    }

                    resolve({
                        ret: 0,
                        amount,
                    });
                }
            });
        });
    }

    /**
     * @comment get inner balance for address
     * @param {string} address
     * @returns {ret: number, amount: string}
     */
    async get_inner_balance(address) {
        const sql = `
            SELECT inner_amount FROM balance WHERE address = ?
        `;

        return new Promise((resolve) => {
            this.db.get(sql, [address], (err, row) => {
                if (err) {
                    console.error('Could not get inner balance', err);
                    resolve({ ret: -1 });
                } else {
                    resolve({
                        ret: 0,
                        amount: row ? row.inner_amount : '0',
                    });
                }
            });
        });
    }

    /**
     * @comment get available inner token's balance for address
     * @param {string} address
     * @returns {ret: number, amount: string}
     */
    async get_available_inner_balance(address) {
        const sql = `
            SELECT inner_amount, inner_transferable_amount FROM balance WHERE address = ?
        `;

        return new Promise((resolve) => {
            this.db.get(sql, [address], (err, row) => {
                if (err) {
                    console.error('Could not get inner balance', err);
                    resolve({ ret: -1 });
                } else {
                    let amount = '0';
                    if (row) {
                        amount = BigNumberUtil.subtract(
                            row.inner_amount,
                            row.inner_transferable_amount,
                        );
                        assert(
                            BigNumberUtil.is_positive_number_string(amount),
                            `amount should be positive number string: ${amount}`,
                        );
                    }

                    resolve({
                        ret: 0,
                        amount,
                    });
                }
            });
        });
    }

    /**
     * @comment get balances for addresses
     * @param {Array} addresses
     * @returns {ret: number, balances: object}
     */
    async get_all_balances(addresses) {
        assert(Array.isArray(addresses), `addresses should be array`);

        const sql = `
            SELECT * FROM balance WHERE address IN (${addresses
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
                        balances[row.address] = row;
                    }
                    resolve({ ret: 0, balances });
                }
            });
        });
    }

    /**
     * @comment transfer brc-20 token's balance from from_address to to_address, return InscriptionOpState.INSUFFICIENT_BALANCE if balance is not enough, return -1 on error, return 0 on success
     * @param {string} from_address
     * @param {string} to_address
     * @param {string} amount
     * @returns {ret: number}
     */
    async transfer_balance(from_address, to_address, amount) {
        return await this._transfer_balance(
            from_address,
            to_address,
            'amount',
            amount,
        );
    }

    /**
     * @comment transfer inner token's balance from from_address to to_address, return InscriptionOpState.INSUFFICIENT_BALANCE if balance is not enough, return -1 on error, return 0 on success
     * @param {string} from_address
     * @param {string} to_address
     * @param {string} amount
     * @returns {ret: number}
     */
    async transfer_inner_balance(from_address, to_address, amount) {
        return await this._transfer_balance(
            from_address,
            to_address,
            'inner_amount',
            amount,
        );
    }

    /**
     * @comment transfer balance from from_address to to_address, return InscriptionOpState.INSUFFICIENT_BALANCE if balance is not enough, return -1 on error, return 0 on success
     * @param {string} from_address
     * @param {string} to_address
     * @param {string} amount
     * @returns {ret: number}
     */
    async _transfer_balance(from_address, to_address, field, amount) {
        assert(
            from_address != to_address,
            `from_address should not be equal to to_address ${from_address}`,
        );

        assert(this.db != null, `db should not be null`);
        assert(
            typeof from_address === 'string',
            `from_address should be string: ${from_address}`,
        );
        assert(
            typeof to_address === 'string',
            `to_address should be string: ${to_address}`,
        );
        assert(typeof field === 'string', `field should be string ${field}`);
        assert(
            BigNumberUtil.is_positive_number_string(amount),
            `amount should be valid number string: ${amount}`,
        );

        // first subtract the amount from from_address
        const { ret: update_from_balance_ret } = await this._update_balance(
            from_address,
            field,
            BigNumberUtil.multiply(amount, -1),
        );
        if (update_from_balance_ret != 0) {
            return { ret: update_from_balance_ret };
        }

        const { ret: update_to_balance_ret } = await this._update_balance(
            to_address,
            field,
            amount,
        );
        if (update_to_balance_ret != 0) {
            return { ret: update_to_balance_ret };
        }

        console.log(
            `transfer balance ${from_address} -> ${to_address} ${amount}`,
        );

        return { ret: 0 };
    }

    /**
     * @comment add balance record for brc-20 token
     * @param {string} inscription_id
     * @param {string} address
     * @param {string} change_amount
     * @param {string} balance
     * @param {number} block_height
     * @param {number} timestamp
     * @param {UserOp} op_type
     * @returns {ret: number}
     */
    async add_balance_record(
        inscription_id,
        address,
        change_amount,
        balance,
        block_height,
        timestamp,
        op_type,
    ) {
        return await this._add_balance_record(
            inscription_id,
            address,
            BalanceRecordTokenType.Default,
            change_amount,
            balance,
            block_height,
            timestamp,
            op_type,
        );
    }

    /**
     * @comment add inner token's balance record
     * @param {string} inscription_id
     * @param {string} address
     * @param {string} change_amount
     * @param {string} balance
     * @param {number} block_height
     * @param {number} timestamp
     * @param {UserOp} op_type
     * @returns {ret: number}
     */
    async add_inner_balance_record(
        inscription_id,
        address,
        change_amount,
        balance,
        block_height,
        timestamp,
        op_type,
    ) {
        return await this._add_balance_record(
            inscription_id,
            address,
            BalanceRecordTokenType.Inner,
            change_amount,
            balance,
            block_height,
            timestamp,
            op_type,
        );
    }

    /**
     *
     * @param {string} inscription_id
     * @param {string} address
     * @param {number} token_type
     * @param {string} change_amount
     * @param {string} balance
     * @param {number} block_height
     * @param {number} timestamp
     * @param {UserOp} op_type
     * @returns {ret: number}
     */
    async _add_balance_record(
        inscription_id,
        address,
        token_type,
        change_amount,
        balance,
        block_height,
        timestamp,
        op_type,
    ) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof inscription_id === 'string',
            `inscription_id should be string: ${inscription_id}`,
        );
        assert(
            typeof address === 'string',
            `address should be string: ${address}`,
        );
        assert(
            _.isNumber(token_type),
            `token_type should be number: ${token_type}`,
        );
        assert(
            BigNumberUtil.is_number_string(change_amount),
            `change_amount should be valid number string: ${change_amount}`,
        );
        assert(
            balance == null || BigNumberUtil.is_number_string(balance),
            `balance should be valid number string: ${balance}`,
        );
        assert(
            _.isNumber(block_height),
            `block_height should be number: ${block_height}`,
        );
        assert(
            _.isNumber(timestamp),
            `timestamp should be number: ${timestamp}`,
        );
        assert(
            typeof op_type === 'string',
            `op_type should be string: ${op_type}`,
        );

        // if balance is null, get it from db
        if (balance == null) {
            if (token_type === BalanceRecordTokenType.Default) {
                const { ret, amount } = await this.get_balance(address);
                if (ret != 0) {
                    console.error(`failed to get balance for ${address}`);
                    return { ret };
                }

                balance = amount;
            } else {
                assert(token_type === BalanceRecordTokenType.Inner);
                const { ret, amount } = await this.get_inner_balance(address);
                if (ret != 0) {
                    console.error(`failed to get inner balance for ${address}`);
                    return { ret };
                }

                balance = amount;
            }

            assert(
                BigNumberUtil.is_positive_number_string(balance),
                `balance should be valid number string: ${balance}`,
            );
        }

        // get next sequence
        const { ret: get_sequence_ret, sequence } =
            await this._get_address_sequence(address);
        if (get_sequence_ret != 0) {
            console.error(`failed to get sequence for ${address}`);
            return { ret: get_sequence_ret };
        }

        // update sequence
        const { ret: set_sequence_ret } = await this._set_address_sequence(
            address,
            sequence + 1,
        );
        if (set_sequence_ret != 0) {
            console.error(`failed to set sequence for ${address}`);
            return { ret: set_sequence_ret };
        }

        return new Promise((resolve) => {
            this.db.run(
                `INSERT INTO balance_records (
                    address_sequence,
                    inscription_id,
                    address,
                    token_type,
                    change_amount,
                    balance,
                    block_height,
                    timestamp,
                    op_type
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    sequence,
                    inscription_id,
                    address,
                    token_type,
                    change_amount,
                    balance,
                    block_height,
                    timestamp,
                    op_type,
                ],
                (err) => {
                    if (err) {
                        console.error('failed to add balance record', err);
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0 });
                    }
                },
            );
        });
    }

    /**
     * @comment get next sequence for address
     * @param {string} address
     * @returns {ret: number, sequence: number}
     */
    async _get_address_sequence(address) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof address === 'string',
            `address should be string: ${address}`,
        );

        return new Promise((resolve) => {
            this.db.get(
                `SELECT sequence FROM address_sequence WHERE address = ?`,
                [address],
                (err, row) => {
                    if (err) {
                        console.error(
                            `Could not get sequence for address ${address}, ${err}`,
                        );
                        resolve({ ret: -1 });
                    } else {
                        if (row == null) {
                            resolve({ ret: 0, sequence: 0 });
                        } else {
                            resolve({ ret: 0, sequence: row.sequence });
                        }
                    }
                },
            );
        });
    }

    /**
     * @comment set next sequence for address
     * @param {string} address
     * @param {number} sequence
     * @returns {ret: number}
     */
    async _set_address_sequence(address, sequence) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof address === 'string',
            `address should be string: ${address}`,
        );
        assert(_.isNumber(sequence), `sequence should be number: ${sequence}`);

        return new Promise((resolve) => {
            this.db.run(
                `INSERT OR REPLACE INTO address_sequence (address, sequence) VALUES (?, ?)`,
                [address, sequence],
                (err) => {
                    if (err) {
                        console.error(
                            `Could not set sequence for address ${address}, ${err}`,
                        );
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0 });
                    }
                },
            );
        });
    }
}

module.exports = {
    TokenBalanceStorage,
    UpdatePoolBalanceOp,
    BalanceRecordTokenType,
};
