const sqlite3 = require('sqlite3').verbose();
const assert = require('assert');
const { BigNumberUtil } = require('../util');

class TokenIncomeStorage {
    constructor(config) {
        assert(config != null, `config should not be null`);

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
            console.error(`failed to init income storage tables`);
            return { ret };
        }

        console.log(`init income storage success`);

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
                    `CREATE TABLE IF NOT EXISTS income (
                        address TEXT PRIMARY KEY,

                        /* for DMCs token, which is the standard brc-20 token*/
                        mint_income TEXT,
                        lucky_mint_income TEXT,
                        burn_mint_income TEXT,

                        transfer_income TEXT,

                        /* for DMC inner token */
                        lucky_mint_inner_income TEXT,
                        burn_mint_inner_income TEXT,

                        exchange_income TEXT,
                        exchange_inner_income TEXT,

                        res_inner_income TEXT,

                        chant_inner_income TEXT,
                        lucky_chant_inner_income TEXT,
                        
                        chant_divide_inner_income TEXT,
                        lucky_chant_divide_inner_income TEXT
                    );`,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to create income table: ${err}`,
                            );
                            has_error = true;
                            resolve({ ret: -1 });
                            return;
                        }

                        console.log(`created income table`);
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
     * @comment update income for mint
     * @param {string} address
     * @param {string} mint_type mint, lucky_mint, burn_mint, lucky_mint_inner, burn_mint_inner
     * @param {string} value
     * @returns {ret: number}
     */
    async update_mint(address, mint_type, value) {
        assert(_.isString(mint_type), `mint_type should be valid string`);

        const field = `${mint_type}_income`;
        return await this._update_field(address, field, value);
    }

    async update_transfer(address, value) {
        const field = 'transfer_income';
        return await this._update_field(address, field, value);
    }

    /**
     * @comment update income for exchange
     * @param {string} address
     * @param {string} exchange_type exchange, exchange_inner
     * @param {string} value
     * @returns {ret: number}
     */
    async update_exchange(address, exchange_type, value) {
        assert(_.isString(exchange_type), `exchange_type should be valid string`);

        const field = `${exchange_type}_income`;
        return await this._update_field(address, field, value);
    }

    async update_res(address, value) {
        const field = 'res_inner_income';
        return await this._update_field(address, field, value);
    }

    async update_chant(address, chant_type, value) {
        assert(_.isString(chant_type), `chant_type should be valid string`);

        const field = `${chant_type}_inner_income`;
        return await this._update_field(address, field, value);
    }

    async update_chant_divide(address, chant_type, value) {
        assert(_.isString(chant_type), `chant_type should be valid string`);

        const field = `${chant_type}_divide_inner_income`;
        return await this._update_field(address, field, value);
    }

    /**
     * @comment update the corresponding field with value
     * @param {string} address
     * @param {string} field
     * @param {string} value
     * @returns {ret: number}
     */
    async _update_field(address, field, value) {
        assert(this.db != null, `db should not be null`);
        assert(_.isString(address), `address should be valid string`);
        assert(_.isString(field), `field should be valid string`);
        assert(BigNumberUtil.is_positive_number_string(value), `value should be valid positive number string`);

        return new Promise((resolve) => {
            // 开始数据库事务
            this.db.serialize( () => {

                // first load the income record
                this.db.get(
                    'SELECT * FROM income WHERE address = ?',
                    [address],
                    (err, row) => {
                        if (err) {
                            console.error(`failed to load income: ${address} ${err}`);
                            resolve({ ret: -1 });
                            return;
                        }

                        if (!row) {
                            // init the income record all fields to 0
                            let fields = [
                                'address',

                                'mint_income',
                                'lucky_mint_income',
                                'burn_mint_income',
                                'transfer_income',

                                'lucky_mint_inner_income',
                                'burn_mint_inner_income',

                                'exchange_income',
                                'exchange_inner_income',

                                'res_inner_income',

                                'chant_inner_income',
                                'lucky_chant_inner_income',

                                'chant_divide_inner_income',
                                'lucky_chant_divide_inner_income',
                            ];
                            let placeholders = fields.map(() => '?').join(',');
                            let values = fields.map((f) =>
                                f === 'address' ? address : '0',
                            );

                            this.db.run(
                                `INSERT INTO income (${fields.join(
                                    ',',
                                )}) VALUES (${placeholders})`,
                                values,
                                (err) => {
                                    if (err) {
                                        console.error(
                                            `failed to init income: ${address} ${err}`,
                                        );
                                        resolve({ ret: -1 });
                                        return;
                                    }
                                },
                            );
                        }

                        // add the value to the field
                        const current_value = row ? row[field] : '0';
                        const new_value = BigNumberUtil.add(current_value, value);
                            
                        this.db.run(
                            `UPDATE income SET ${field} = ? WHERE address = ?`,
                            [new_value, address],
                            (err) => {
                                if (err) {
                                    console.error(
                                        `failed to update income: ${address} ${value} ${err}`,
                                    );
                                    resolve({ ret: -1 });
                                    return;
                                }

                                console.log(`updated income: ${address} ${field} ${value} -> ${new_value}`);
                                resolve({ ret: 0 });
                            },
                        );
                    },
                );
            });
        });
    }
}


module.exports = { TokenIncomeStorage };