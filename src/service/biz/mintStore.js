const { store, TABLE_NAME } = require('./store');
const { ERR_CODE, makeReponse, makeSuccessReponse } = require('./util');

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
    queryMintRecordByAddress(address, length, offset, order) {
        if (!address) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        order = order == "ASC" ? "ASC" : "DESC";
        let count = 0;
        let list = [];

        try {
            const countStmt = store.indexDB.prepare(`SELECT COUNT(*) AS count FROM ${TABLE_NAME.MINT} WHERE address = ?`);
            const countResult = countStmt.get(address);
            count = countResult.count;

            if (count > 0) {
                const pageStmt = store.indexDB.prepare(`SELECT * FROM ${TABLE_NAME.MINT} WHERE address = ? ORDER BY timestamp ${order} LIMIT ? OFFSET ?`);
                list = pageStmt.all(address, length, offset);
            }

            logger.debug('queryMintRecordByAddress:', address, offset, length, "ret:", count, list);

        } catch (error) {
            logger.error('queryMintRecordByAddress failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }

        return makeSuccessReponse({ count, list });
    }

    queryLuckyMintRecord(length, offset, order) {
        order = order == "ASC" ? "ASC" : "DESC";
        let count = 0;
        let list = [];

        try {
            const countStmt = store.indexDB.prepare(`SELECT COUNT(*) AS count FROM ${TABLE_NAME.MINT} WHERE lucky is not null`);
            const countResult = countStmt.get();
            count = countResult.count;

            if (count > 0) {
                const pageStmt = store.indexDB.prepare(`SELECT * FROM ${TABLE_NAME.MINT} WHERE lucky is not null ORDER BY timestamp ${order} LIMIT ? OFFSET ?`);
                list = pageStmt.all(length, offset);
            }

            logger.debug('queryLuckyMintRecord:', offset, length, "ret:", count, list);

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
            const stmt = store.indexDB.prepare(`SELECT SUM(amount) AS total FROM ${TABLE_NAME.MINT} WHERE timestamp >= ? AND timestamp < ?`);
            const ret = stmt.get(beginTime, endTime);
            const total = ret.total;

            logger.debug('queryTotalMintByTime: ret:', total);

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
            const stmt = store.indexDB.prepare(`SELECT amount FROM ${TABLE_NAME.BALANCE} WHERE address = ?`);
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
            const ethStmt = store.ethDB.prepare(`SELECT value FROM ${TABLE_NAME.STATE} WHERE name = ?`);
            const ethRet = ethStmt.get('latest_block_height');
            const ethHeight = ethRet.value;

            const btcStmt = store.inscriptionDB.prepare(`SELECT value FROM ${TABLE_NAME.STATE} WHERE name = ?`);
            const btcRet = btcStmt.get('latest_block_height');
            const btcHeight = btcRet.value;

            const ret = {
                ethHeight,
                btcHeight,
            };

            logger.debug('queryIndexerState: ret:', ret);

            return makeSuccessReponse(ret);

        } catch (error) {
            logger.error('queryIndexerState failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }

    }
}

module.exports = {
    MintStore
};