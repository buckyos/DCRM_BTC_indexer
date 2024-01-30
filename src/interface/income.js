const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { Util, BigNumberUtil } = require('../util');
const { TOKEN_INDEX_DB_FILE } = require('../constants');
const sqlite3 = require('sqlite3').verbose();
const {
    BalanceRecordDirection,
    BalanceRecordTokenType,
    BalanceOp,
} = require('../storage/balance');

class IncomeStat {
    constructor(config) {
        assert(_.isObject(config), `config should be object`);

        this.config = config;

        const { ret, dir } = Util.get_data_dir(config);
        if (ret !== 0) {
            throw new Error(`failed to get data dir`);
        }

        this.db_file_path = path.join(dir, TOKEN_INDEX_DB_FILE);
        this.db = null;
    }

    async init() {
        const { ret } = await this._init_db();
        if (ret !== 0) {
            console.error(`failed to init db`);
            return { ret };
        }

        return { ret: 0 };
    }

    /**
     *
     * @returns {ret: number}
     */
    async _init_db() {
        assert(this.db == null, `TokenIndexStorage db should be null`);
        assert(
            fs.existsSync(this.db_file_path),
            `db file should exist ${this.db_file_path}`,
        );

        return new Promise((resolve) => {
            assert(this.db == null, `TokenIndexStorage db should be null`);
            this.db = new sqlite3.Database(
                this.db_file_path,
                sqlite3.OPEN_READONLY,
                (err) => {
                    if (err) {
                        console.error(`failed to connect to sqlite: ${err}`);
                        resolve({ ret: -1 });
                        return;
                    }

                    console.log(`Stat connected to ${this.db_file_path}`);
                    resolve({ ret: 0 });
                },
            );
        });
    }

    _default_stat_target() {
        const target = {};
        for (const key of Object.keys(BalanceOp)) {
            if (_.isString(BalanceOp[key])) {
                target[BalanceOp[key]] = '0';
            }
        }

        return target;
    }

    async get_user_income_stat(address) {
        assert(_.isString(address), `address should be string: ${address}`);

        // get stat for last 24 hours
        const now = Date.now();
        const since = (now - 24 * 3600 * 1000) / 1000;

        const { ret, list: income_stat } = await this._get_user_income_list_since(
            address,
            since,
        );
        if (ret !== 0) {
            console.error(`failed to get user income stat for ${address}`);
            return { ret };
        }

        const stat = {
            income: this._default_stat_target(),
            inner_income: this._default_stat_target(),
        };

        for (const record of income_stat) {
            assert(
                BigNumberUtil.is_positive_number_string(record.change_amount),
                `invalid change_amount: ${record.amount}`,
            );

            let target;
            if (record.token_type == BalanceRecordTokenType.Default) {
                target = stat.income;
            } else {
                assert(
                    record.token_type === BalanceRecordTokenType.Inner,
                    `invalid token_type: ${record.token_type}`,
                );

                target = stat.inner_income;
            }

            target[record.op_type] = BigNumberUtil.add(
                target[record.op_type],
                record.change_amount,
            );
        }

        return { ret: 0, stat };
    }

    /**
     * 
     * @param {string} address 
     * @param {number} timestamp 
     * @returns {ret: number, list: object[]}
     */
    async _get_user_income_list_since(address, timestamp) {
        assert(this.db != null, `db should not be null`);
        assert(
            typeof address === 'string',
            `address should be string: ${address}`,
        );
        assert(
            _.isNumber(timestamp),
            `timestamp should be number: ${timestamp}`,
        );

        const sql = `
            SELECT * FROM balance_records WHERE address = ? AND direction = ? AND timestamp >= ? ORDER BY timestamp ASC
        `;

        return new Promise((resolve) => {
            this.db.all(
                sql,
                [address, BalanceRecordDirection.In, timestamp],
                (err, rows) => {
                    if (err) {
                        console.error(
                            `Could not get user income list since ${timestamp} for address ${address}, ${err}`,
                        );
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0, list: rows });
                    }
                },
            );
        });
    }
}


module.exports = { IncomeStat };