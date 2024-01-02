const { store, TABLE_NAME } = require('./store');
const { ERR_CODE, makeReponse, makeSuccessReponse } = require('./util');
const { InscriptionOpState, InscriptionStage } = require('../../index/ops/state');
const { BigNumberUtil, Util } = require('../../util');

class MintStore {
    constructor() {
    }

    // return null or data
    queryMintRecordByHash(hash) {
        // const stmt = store.db.prepare('SELECT * FROM mint WHERE hash = ?');
        // const ret = stmt.get(hash);

        // logger.debug('queryInscriptionByHash:', hash, "ret:", ret);

        return null;
    }

    //return {count, list}
    queryMintRecordByAddress(address, limit, offset, order) {
        if (!address) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        order = order == "ASC" ? "ASC" : "DESC";
        let count = 0;
        let list = [];

        try {
            const countStmt = store.indexDB.prepare(
                `SELECT COUNT(*) AS count 
                FROM ${TABLE_NAME.MINT} WHERE address = ?`
            );
            const countResult = countStmt.get(address);
            count = countResult.count;

            if (count > 0) {
                const pageStmt = store.indexDB.prepare(
                    `SELECT * FROM ${TABLE_NAME.MINT} 
                    WHERE address = ? 
                    ORDER BY timestamp ${order} 
                    LIMIT ? OFFSET ?`
                );
                list = pageStmt.all(address, limit, offset);
            }

            logger.debug('queryMintRecordByAddress:', address, offset, limit, "ret:", count, list);

        } catch (error) {
            logger.error('queryMintRecordByAddress failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }

        return makeSuccessReponse({ count, list });
    }

    queryLuckyMintRecord(limit, offset, order) {
        order = order == "ASC" ? "ASC" : "DESC";
        let count = 0;
        let list = [];

        try {
            const countStmt = store.indexDB.prepare(
                `SELECT COUNT(*) AS count 
                FROM ${TABLE_NAME.MINT} 
                WHERE lucky is not null`
            );
            const countResult = countStmt.get();
            count = countResult.count;

            if (count > 0) {
                const pageStmt = store.indexDB.prepare(
                    `SELECT * FROM ${TABLE_NAME.MINT} 
                    WHERE lucky is not null 
                    ORDER BY timestamp ${order} 
                    LIMIT ? OFFSET ?`
                );
                list = pageStmt.all(limit, offset);
            }
            for (const item of list) {
                if (item.inscription_id) {
                    const { ret, txid, index } = Util.parse_inscription_id(item.inscription_id);
                    if (ret == 0) {
                        item.txid = txid;
                        item.index = index;
                    }
                }
            }

            logger.debug('queryLuckyMintRecord:', offset, limit, "ret:", count, list);

        } catch (error) {
            logger.error('queryLuckyMintRecord failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }

        return makeSuccessReponse({ count, list });
    }

    queryTotalMintByTime(beginTime, endTime) {
        if (!beginTime || !endTime) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        try {
            const stmt = store.indexDB.prepare(
                `SELECT amount
                FROM ${TABLE_NAME.MINT} 
                WHERE timestamp >= ? AND timestamp < ?`
            );
            const ret = stmt.all(beginTime, endTime);

            let total = '0';
            for (const item of ret) {
                total = BigNumberUtil.add(total, item.amount);
            }

            console.log('ret:', ret);

            logger.debug('queryTotalMintByTime', beginTime, endTime, ', ret:', total);

            return makeSuccessReponse(total);

        } catch (error) {
            logger.error('queryTotalMintByTime failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    queryBalanceByAddress(address) {
        if (!address) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        try {
            const stmt = store.indexDB.prepare(
                `SELECT amount FROM ${TABLE_NAME.BALANCE} 
                WHERE address = ?`
            );
            const ret = stmt.get(address);
            if (ret != null) {
                const amount = ret.amount;
                logger.debug('queryBalanceByAddress:', address, "ret:", amount);

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
            const ethStmt = store.ethDB.prepare(
                `SELECT value FROM ${TABLE_NAME.STATE} WHERE name = ?`
            );
            const ethRet = ethStmt.get('latest_block_height');
            const ethHeight = ethRet.value;

            const btcStmt = store.inscriptionDB.prepare(
                `SELECT value FROM ${TABLE_NAME.STATE} WHERE name = ?`
            );
            const btcRet = btcStmt.get('latest_block_height');
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
                mint: '0',              // mint
                chant_bouns: '0',       // chant other's inscription
                chanted_bouns: '0',     // chanted by others
                resonance_bouns: '0',   // resonance by others
            };
            let stmt = store.indexDB.prepare(
                `SELECT amount
                FROM ${TABLE_NAME.MINT} 
                WHERE address = ? AND timestamp >= ? AND timestamp < ?`
            );
            let ret = stmt.all(address, beginTime, endTime);
            let total = '0';
            for (const item of ret) {
                total = BigNumberUtil.add(total, item.amount);
            }
            result.mint = total;

            stmt = store.indexDB.prepare(
                `SELECT i.hash, r.owner_bouns
                FROM ${TABLE_NAME.INSCRIBE} i
                JOIN ${TABLE_NAME.RESONANCE} r ON i.hash = r.hash
                WHERE i.address = ? AND r.timestamp >= ? AND r.timestamp < ? AND r.state = ?`
            );
            ret = stmt.all(address, beginTime, endTime, InscriptionOpState.OK);
            total = '0';
            for (const item of ret) {
                total = BigNumberUtil.add(total, item.owner_bouns);
            }
            result.resonance_bouns = total;

            stmt = store.indexDB.prepare(
                `SELECT i.hash, c.owner_bouns
                FROM ${TABLE_NAME.INSCRIBE} i
                JOIN  ${TABLE_NAME.CHANT} c ON i.hash = c.hash
                WHERE i.address = ? AND c.timestamp >= ? AND c.timestamp < ? AND c.state = ?`
            );
            ret = stmt.all(address, beginTime, endTime, InscriptionOpState.OK);
            total = '0';
            for (const item of ret) {
                total = BigNumberUtil.add(total, item.owner_bouns);
            }
            result.chanted_bouns = total;

            stmt = store.indexDB.prepare(
                `SELECT user_bouns
                FROM ${TABLE_NAME.CHANT}
                WHERE address = ? AND timestamp >= ? AND timestamp < ? AND state = ?`
            );
            ret = stmt.all(address, beginTime, endTime, InscriptionOpState.OK);
            total = '0';
            for (const item of ret) {
                total = BigNumberUtil.add(total, item.user_bouns);
            }
            result.chant_bouns = total;

            logger.debug('queryIncomeByTime: ret:', result);

            return makeSuccessReponse(result);

        } catch (error) {
            logger.error('queryIncomeByTime failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }
}

module.exports = {
    MintStore
};