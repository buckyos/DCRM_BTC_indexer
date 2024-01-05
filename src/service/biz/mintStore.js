const { store, TABLE_NAME } = require('./store');
const { ERR_CODE, makeReponse, makeSuccessReponse } = require('./util');
const {
    InscriptionOpState,
    InscriptionStage,
    MintType
} = require('../../index/ops/state');
const { BigNumberUtil } = require('../../util');
const {
    TOKEN_MINT_POOL_INIT_AMOUNT,
    TOKEN_MINT_POOL_VIRTUAL_ADDRESS,
    TOKEN_MINT_POOL_SERVICE_CHARGED_VIRTUAL_ADDRESS
} = require('../../constants');

const SUCCESS = "SUCCESS";
const FAILED = "FAILED";

class MintStore {
    constructor() { }

    // return null or data
    queryMintRecordByHash(hash) {
        // const stmt = store.db.prepare('SELECT * FROM mint WHERE hash = ?');
        // const ret = stmt.get(hash);

        // logger.debug('queryInscriptionByHash:', hash, "ret:", ret);

        return null;
    }

    queryMintRecordByAddress(address, limit, offset, state, order) {
        if (!address) {
            return makeReponse(ERR_CODE.INVALID_PARAM, 'invalid param');
        }

        order = order == 'ASC' ? 'ASC' : 'DESC';
        let count = 0;
        let list = [];

        try {
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.MINT_RECORDS}
                WHERE address = ?`;
            if (state == SUCCESS) {
                sql += ` AND state = ${InscriptionOpState.OK}`;
            } else if (state == FAILED) {
                sql += ` AND state != ${InscriptionOpState.OK}`;
            }
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(address);
            count = countResult.count;

            if (count > 0) {
                sql =
                    `SELECT * FROM ${TABLE_NAME.MINT_RECORDS}
                    WHERE address = ?`;
                if (state == SUCCESS) {
                    sql += ` AND state = ${InscriptionOpState.OK}`;
                } else if (state == FAILED) {
                    sql += ` AND state != ${InscriptionOpState.OK}`;
                }
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;
                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(address, limit, offset);
            }

            logger.debug(
                'queryMintRecordByAddress:',
                address,
                offset,
                limit,
                'ret:',
                count,
            );
        } catch (error) {
            logger.error('queryMintRecordByAddress failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }

        return makeSuccessReponse({ count, list });
    }

    queryMintRecordByTx(txid) {
        if (!txid) {
            return makeReponse(ERR_CODE.INVALID_PARAM, 'invalid param');
        }

        try {
            const stmt = store.indexDB.prepare(
                `SELECT * FROM ${TABLE_NAME.MINT_RECORDS} WHERE txid = ?`,
            );
            const ret = stmt.get(txid);

            logger.debug('queryMintRecordByTx:', txid, 'ret:', ret);

            return ret ? makeSuccessReponse(ret) : makeReponse(ERR_CODE.NOT_FOUND);
        } catch (error) {
            logger.error('queryMintRecordByTx failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    queryLuckyMintRecord(limit, offset, order) {
        order = order == 'ASC' ? 'ASC' : 'DESC';
        let count = 0;
        let list = [];

        try {
            const countStmt = store.indexDB.prepare(
                `SELECT COUNT(*) AS count 
                FROM ${TABLE_NAME.MINT_RECORDS} 
                WHERE mint_type = ? AND state = ?`,
            );
            const countResult = countStmt.get(MintType.LuckyMint, InscriptionOpState.OK);
            count = countResult.count;

            if (count > 0) {
                const pageStmt = store.indexDB.prepare(
                    `SELECT * FROM ${TABLE_NAME.MINT_RECORDS} 
                    WHERE mint_type = ? AND state = ?
                    ORDER BY timestamp ${order} 
                    LIMIT ? OFFSET ?`,
                );
                list = pageStmt.all(MintType.LuckyMint, InscriptionOpState.OK, limit, offset);
            }

            logger.debug(
                'queryLuckyMintRecord:',
                offset,
                limit,
                'ret:',
                count,
            );
        } catch (error) {
            logger.error('queryLuckyMintRecord failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }

        return makeSuccessReponse({ count, list });
    }

    queryTotalMintByTime(beginTime, endTime) {
        if (!beginTime || !endTime) {
            return makeReponse(ERR_CODE.INVALID_PARAM, 'invalid param');
        }

        try {
            const stmt = store.indexDB.prepare(
                `SELECT amount
                FROM ${TABLE_NAME.MINT_RECORDS} 
                WHERE timestamp >= ? AND timestamp < ? AND state = ?`,
            );
            const ret = stmt.all(beginTime, endTime, InscriptionOpState.OK);

            let total = '0';
            for (const item of ret) {
                total = BigNumberUtil.add(total, item.amount);
            }

            console.log('ret:', ret);

            logger.debug(
                'queryTotalMintByTime',
                beginTime,
                endTime,
                ', ret:',
                total,
            );

            return makeSuccessReponse(total);
        } catch (error) {
            logger.error('queryTotalMintByTime failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    queryMintProgress() {
        try {
            const stmt = store.indexDB.prepare(
                `SELECT * FROM ${TABLE_NAME.BALANCE} 
                WHERE address = ? or address = ?`
            );
            const ret = stmt.all(
                TOKEN_MINT_POOL_VIRTUAL_ADDRESS,
                TOKEN_MINT_POOL_SERVICE_CHARGED_VIRTUAL_ADDRESS
            );
            const result = {
                total: TOKEN_MINT_POOL_INIT_AMOUNT,
                service_charged: '0',
                pool_balance: '0',
            };
            if (ret && ret.length > 0) {
                for (const item of ret) {
                    if (item.address == TOKEN_MINT_POOL_VIRTUAL_ADDRESS) {
                        result.pool_balance = item.amount;
                    } else if (item.address == TOKEN_MINT_POOL_SERVICE_CHARGED_VIRTUAL_ADDRESS) {
                        result.service_charged = item.amount;
                    }
                }
            }

            return makeSuccessReponse(result);

        } catch (error) {
            logger.error('queryBalanceByAddress failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    queryBalanceByAddress(address) {
        if (!address) {
            return makeReponse(ERR_CODE.INVALID_PARAM, 'invalid param');
        }

        try {
            const stmt = store.indexDB.prepare(
                `SELECT amount FROM ${TABLE_NAME.BALANCE} 
                WHERE address = ?`,
            );
            const ret = stmt.get(address);
            if (ret != null) {
                const amount = ret.amount;
                logger.debug('queryBalanceByAddress:', address, 'ret:', amount);

                return makeSuccessReponse(amount);
            }

            return makeReponse(ERR_CODE.NOT_FOUND);
        } catch (error) {
            logger.error('queryBalanceByAddress failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    queryIndexerState() {
        try {
            const ethStmt = store.stateDB.prepare(
                `SELECT value FROM ${TABLE_NAME.STATE} WHERE name = ?`,
            );
            const ethRet = ethStmt.get('eth_latest_block_height');
            const ethHeight = ethRet.value;

            const btcStmt = store.stateDB.prepare(
                `SELECT value FROM ${TABLE_NAME.STATE} WHERE name = ?`,
            );
            const btcRet = btcStmt.get('btc_latest_block_height');
            const btcHeight = btcRet.value;

            const ret = {
                eth_height: ethHeight,
                btc_height: btcHeight,
            };

            logger.debug('queryIndexerState: ret:', ret);

            return makeSuccessReponse(ret);
        } catch (error) {
            logger.error('queryIndexerState failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    queryIncomeByTime(address, beginTime, endTime) {
        try {
            const result = {
                mint: '0', // mint
                chant_bonus: '0', // chant other's inscription
                chanted_bonus: '0', // chanted by others
                resonance_bonus: '0', // resonance by others
            };
            let stmt = store.indexDB.prepare(
                `SELECT amount
                FROM ${TABLE_NAME.MINT_RECORDS} 
                WHERE address = ? AND timestamp >= ? AND timestamp < ?`,
            );
            let ret = stmt.all(address, beginTime, endTime);
            let total = '0';
            for (const item of ret) {
                total = BigNumberUtil.add(total, item.amount);
            }
            result.mint = total;

            stmt = store.indexDB.prepare(
                `SELECT i.hash, r.owner_bonus
                FROM ${TABLE_NAME.INSCRIBE_DATA} i
                JOIN ${TABLE_NAME.RESONANCE_RECORDS} r ON i.hash = r.hash
                WHERE i.address = ? AND r.timestamp >= ? AND r.timestamp < ? AND r.state = ?`,
            );
            ret = stmt.all(address, beginTime, endTime, InscriptionOpState.OK);
            total = '0';
            for (const item of ret) {
                total = BigNumberUtil.add(total, item.owner_bonus);
            }
            result.resonance_bonus = total;

            stmt = store.indexDB.prepare(
                `SELECT i.hash, c.owner_bonus
                FROM ${TABLE_NAME.INSCRIBE_DATA} i
                JOIN  ${TABLE_NAME.CHANT_RECORDS} c ON i.hash = c.hash
                WHERE i.address = ? AND c.timestamp >= ? AND c.timestamp < ? AND c.state = ?`,
            );
            ret = stmt.all(address, beginTime, endTime, InscriptionOpState.OK);
            total = '0';
            for (const item of ret) {
                total = BigNumberUtil.add(total, item.owner_bonus);
            }
            result.chanted_bonus = total;

            stmt = store.indexDB.prepare(
                `SELECT user_bonus
                FROM ${TABLE_NAME.CHANT_RECORDS}
                WHERE address = ? AND timestamp >= ? AND timestamp < ? AND state = ?`,
            );
            ret = stmt.all(address, beginTime, endTime, InscriptionOpState.OK);
            total = '0';
            for (const item of ret) {
                total = BigNumberUtil.add(total, item.user_bonus);
            }
            result.chant_bonus = total;

            logger.debug('queryIncomeByTime: ret:', result);

            return makeSuccessReponse(result);
        } catch (error) {
            logger.error('queryIncomeByTime failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }
}

module.exports = {
    MintStore,
};
