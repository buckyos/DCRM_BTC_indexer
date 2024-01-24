const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { Util } = require('../util');
const { TOKEN_INDEX_DB_FILE } = require('../constants');
const sqlite3 = require('sqlite3').verbose();
const BigNumber = require('bignumber.js');
const { MintType } = require('../token_index/ops/state');
const moment = require('moment');

class TokenStat {
    constructor(config) {
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

    async stat(stat_type, start_time, end_time) {
        if (!_.isNumber(start_time) || start_time < 0) {
            console.warn(`start time should be number`);
            return { ret: 0, status: 400 };
        }

        if (!_.isNumber(end_time) || end_time < 0) {
            console.warn(`end time should be number`);
            return { ret: 0, status: 400 };
        }

        if (end_time == 0) {
            end_time = Math.floor(Date.now() / 1000);
        }

        if (start_time == 0) {
            start_time = end_time - 24 * 3600;
        }

        if (start_time >= end_time) {
            console.warn(`start time should be less than end time`);
            return { ret: 0, status: 400 };
        }

        if (stat_type === 'mint') {
            return await this.stat_mint(start_time, end_time);
        } else if (stat_type === 'all') {
            const all = {};

            const { ret, stat } = await this.stat_mint(start_time, end_time);
            if (ret !== 0) {
                console.error(`failed to stat mint: ${ret}`);
                return { ret };
            }

            all.mint = stat;

            // stat balance
            const { ret: balance_ret, stat: balance_stat } =
                await this.stat_balance(100);
            if (balance_ret !== 0) {
                console.error(`failed to stat balance: ${balance_ret}`);
                return { ret: balance_ret };
            }

            all.balance = balance_stat;
            
            return { ret: 0, stat: all };
        }

        console.warn(`unknown stat type: ${stat_type}`);
        return { ret: 0, status: 400 };
    }

    async stat_mint(start_time, end_time) {
        assert(this.db != null, `db should be connected`);
        assert(_.isNumber(start_time), `start_time should be number`);
        assert(_.isNumber(end_time), `end_time should be number`);
        assert(
            start_time < end_time,
            `start_time should be less than end_time`,
        );

        return await this._stat_mint(start_time, end_time);
    }

    async _stat_mint(start_time, end_time) {
        const stat = {};

        // stat total mint amount and count
        let all_amount = new BigNumber(0);
        let all_count = 0;

        // stat all mint types
        for (const [key, value] of Object.entries(MintType)) {
            // calc total mint amount for each mint type
            const { ret, total_amount, total_count } =
                await this._calc_total_mint_amount(value, start_time, end_time);
            if (ret !== 0) {
                console.error(`failed to calc total mint amount: ${ret}`);
                return { ret };
            }

            all_amount = all_amount.plus(new BigNumber(total_amount));
            all_count += total_count;

            stat[key] = {
                total_amount,
                total_count,
            };
        }

        stat.all = {
            total_amount: all_amount.toString(),
            total_count: all_count,
        };
        
        const start = moment(start_time * 1000).format(
            'YYYY-MM-DD_HH:mm:ss.SSS',
        );
        const end = moment(end_time * 1000).format('YYYY-MM-DD_HH:mm:ss.SSS');

        stat.start = start;
        stat.end = end;

        return { ret: 0, stat };
    }

    async _calc_total_mint_amount(mint_type, start_time, end_time) {
        assert(this.db != null, `db should be connected`);

        // calc total mint amount by page
        let total_amount = new BigNumber(0);
        let total_count = 0;
        let page_index = 0;
        const page_size = 100;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const {
                ret,
                total_amount: page_amount,
                count,
            } = await this._calc_total_mint_amount_by_page(
                mint_type,
                start_time,
                end_time,
                page_size,
                page_index,
            );
            if (ret !== 0) {
                console.error(
                    `failed to calc total mint amount by page: ${ret}`,
                );
                return { ret };
            }

            total_amount = total_amount.plus(new BigNumber(page_amount));

            total_count += count;
            if (count < page_size) {
                break;
            }

            page_index += 1;
        }

        return { ret: 0, total_amount: total_amount.toString(), total_count };
    }

    async _calc_total_mint_amount_by_page(
        mint_type,
        start_time,
        end_time,
        page_size,
        page_index,
    ) {
        assert(this.db != null, `db should be connected`);

        return new Promise((resolve) => {
            this.db.all(
                `SELECT amount FROM mint_records
                 WHERE mint_type = ? AND timestamp >= ? AND timestamp <= ? AND state = 0 
                 LIMIT ? OFFSET ?`,
                [
                    mint_type,
                    start_time,
                    end_time,
                    page_size,
                    page_size * page_index,
                ],
                (err, rows) => {
                    if (err) {
                        console.error(`failed to stat mint: ${err}`);
                        resolve({ ret: -1 });
                        return;
                    }

                    let total_amount = new BigNumber(0);
                    for (const row of rows) {
                        total_amount = total_amount.plus(
                            new BigNumber(row.amount),
                        );
                    }

                    resolve({
                        ret: 0,
                        total_amount: total_amount.toString(),
                        count: rows.length,
                    });
                },
            );
        });
    }

    async stat_balance(top_n) {
        assert(this.db != null, `db should be connected`);
        if (!_.isNumber(top_n)) {
            console.error(`top_n should be number: ${top_n}`);
            return { ret: -1, status: 400 };
        }

        const { ret, stat } = await this._stat_balance(top_n);
        if (ret !== 0) {
            console.error(`failed to stat balance: ${ret}`);
            return { ret };
        }

        // remove item that address that length short than 5
        const new_stat = [];
        let index = 1;
        for (const item of stat) {
            if (item.address.length < 5) {
                continue;
            }

            item.index = index;
            ++index;
            new_stat.push(item);
        }

        return { ret: 0, status: 200, stat: new_stat };
    }

    /**
     * 
     * @param {number} top_n 
     * @returns {Promise<{ret: number, stat: Array<{address: string, amount: string}>}>}
     */
    async _stat_balance(top_n) {
        assert(this.db != null, `db should be connected`);
        assert(_.isNumber(top_n), `top_n should be number`);

        return new Promise((resolve, reject) => {
            const sql = `
                    SELECT address, CAST(amount AS DECIMAL) + CAST(inner_amount AS DECIMAL) AS total_amount, amount, inner_amount
                    FROM balance
                    ORDER BY total_amount DESC
                    LIMIT ?;
                `;

            this.db.all(sql, [top_n], (err, rows) => {
                if (err) {
                    console.error(`failed to stat balance: ${err}`);
                    reject(err);
                } else {
                    resolve({ ret: 0, stat: rows });
                }
            });
        });
    }
}

module.exports = { TokenStat };
