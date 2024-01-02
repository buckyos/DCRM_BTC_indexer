const { store, TABLE_NAME } = require('./store');
const { ERR_CODE, makeReponse, makeSuccessReponse } = require('./util');
const { InscriptionOpState, InscriptionStage } = require('../../index/ops/state');

class InscribeStore {
    constructor() {
    }

    // return null or data
    queryInscriptionByHash(hash) {
        if (!hash) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        try {
            const stmt = store.indexDB.prepare(`SELECT * FROM ${TABLE_NAME.INSCRIBE} WHERE hash = ?`);
            const ret = stmt.get(hash);

            logger.debug('queryInscriptionByHash:', hash, "ret:", ret);

            if (ret) {
                return makeSuccessReponse(ret);
            }

            return makeReponse(ERR_CODE.NOT_FOUND, "not found");

        } catch (error) {
            logger.error('queryInscriptionByHash failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    //return {count, list}
    queryInscriptionByAddress(address, limit, offset, order) {
        if (!address) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        order = order == "ASC" ? "ASC" : "DESC";
        try {
            let list = [];
            const countStmt = store.indexDB.prepare(`SELECT COUNT(*) AS count FROM ${TABLE_NAME.INSCRIBE} WHERE address = ?`);
            const countResult = countStmt.get(address);
            const count = countResult.count;

            if (count > 0) {
                const pageStmt = store.indexDB.prepare(`SELECT * FROM ${TABLE_NAME.INSCRIBE} WHERE address = ? ORDER BY timestamp ${order} LIMIT ? OFFSET ?`);
                list = pageStmt.all(address, limit, offset);
            }

            logger.debug('queryInscriptionByAddress:', address, offset, limit, "ret:", count, list);

            return makeSuccessReponse({ count, list });

        } catch (error) {
            logger.error('queryInscriptionByAddress failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }

    }

    //[begin, end) return {count, list}
    queryInscriptionByBlock(beginBlock, endBlock, limit, offset, order) {
        if (!beginBlock) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        order = order == "ASC" ? "ASC" : "DESC";
        try {
            let list = [];
            const countStmt = store.indexDB.prepare(`SELECT COUNT(*) AS count FROM ${TABLE_NAME.INSCRIBE} WHERE block_height >= ? AND block_height < ?`);
            const countResult = countStmt.get(beginBlock, endBlock);
            const count = countResult.count;

            if (count > 0) {
                const pageStmt = store.indexDB.prepare(`SELECT * FROM ${TABLE_NAME.INSCRIBE} WHERE block_height >= ? AND block_height < ? ORDER BY timestamp ${order} LIMIT ? OFFSET ?`);
                list = pageStmt.all(beginBlock, endBlock, limit, offset);
            }

            logger.debug('queryInscriptionByBlock:', beginBlock, endBlock, offset, limit, "ret:", count, list);

            return makeSuccessReponse({ count, list });

        } catch (error) {
            logger.error('queryInscriptionByBlock failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    queryInscriptionCount() {
        try {
            const stmt = store.indexDB.prepare(`SELECT COUNT(*) AS count FROM ${TABLE_NAME.INSCRIBE}`);
            const ret = stmt.get();
            const count = ret.count;

            logger.debug('queryInscriptionCount: ret:', count);

            return makeSuccessReponse(count);
        } catch (error) {
            logger.error('queryInscriptionCount failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    // return {count, list}
    queryResonanceByHash(hash, limit, offset, order) {
        if (!hash) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        order = order == "ASC" ? "ASC" : "DESC";

        try {
            let list = [];
            const countStmt = store.indexDB.prepare(
                `SELECT COUNT(*) AS count 
                FROM ${TABLE_NAME.RESONANCE} 
                WHERE hash = ? AND state = ?`
            );
            const countResult = countStmt.get(hash, InscriptionOpState.OK);
            const count = countResult.count;
            if (count > 0) {
                const pageStmt = store.indexDB.prepare(
                    `SELECT * FROM ${TABLE_NAME.RESONANCE} 
                    WHERE hash = ? AND state = ?
                    ORDER BY timestamp ${order} 
                    LIMIT ? OFFSET ?`
                );
                list = pageStmt.all(hash, InscriptionOpState.OK, limit, offset);
            }

            logger.debug('queryResonanceByHash:', hash, offset, limit, "ret:", count, list);

            return makeSuccessReponse({ count, list });
        } catch (error) {
            logger.error('queryResonanceByHash failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    // return {count, list}
    queryResonanceByAddress(address, limit, offset, order) {
        if (!address) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        order = order == "ASC" ? "ASC" : "DESC";

        try {
            let list = [];
            const countStmt = store.indexDB.prepare(
                `SELECT COUNT(*) AS count 
                FROM ${TABLE_NAME.RESONANCE} 
                WHERE address = ? AND state = ?`
            );
            const countResult = countStmt.get(address, InscriptionOpState.OK);
            const count = countResult.count;

            if (count > 0) {
                const pageStmt = store.indexDB.prepare(
                    `SELECT * FROM ${TABLE_NAME.RESONANCE} 
                    WHERE address = ? AND state = ?
                    ORDER BY timestamp ${order} 
                    LIMIT ? OFFSET ?`
                );
                list = pageStmt.all(address, InscriptionOpState.OK, limit, offset);
            }

            logger.debug('queryResonanceByAddress:', address, offset, limit, "ret:", count, list);

            return makeSuccessReponse({ count, list });

        } catch (error) {
            logger.error('queryResonanceByAddress failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    // return {count, list}
    queryChantByHash(hash, limit, offset, order) {
        if (!hash) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        order = order == "ASC" ? "ASC" : "DESC";

        try {
            let list = [];
            const countStmt = store.indexDB.prepare(
                `SELECT COUNT(*) AS count 
                FROM ${TABLE_NAME.CHANT} 
                WHERE hash = ? AND state = ?`
            );
            const countResult = countStmt.get(hash, InscriptionOpState.OK);
            const count = countResult.count;

            if (count > 0) {
                const pageStmt = store.indexDB.prepare(
                    `SELECT * FROM ${TABLE_NAME.CHANT} 
                    WHERE hash = ? AND state = ?
                    ORDER BY timestamp ${order} 
                    LIMIT ? OFFSET ?`
                );
                list = pageStmt.all(hash, InscriptionOpState.OK, limit, offset);
            }

            logger.debug('queryChantByHash:', hash, offset, limit, "ret:", count, list);

            return makeSuccessReponse({ count, list });

        } catch (error) {
            logger.error('queryChantByHash failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    // return {count, list}
    queryChantByAddress(address, limit, offset, order) {
        if (!address) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        order = order == "ASC" ? "ASC" : "DESC";

        try {
            let list = [];
            const countStmt = store.indexDB.prepare(
                `SELECT COUNT(*) AS count 
                FROM ${TABLE_NAME.CHANT} 
                WHERE address = ? AND state = ?`
            );
            const countResult = countStmt.get(address, InscriptionOpState.OK);
            const count = countResult.count;

            if (count > 0) {
                const pageStmt = store.indexDB.prepare(
                    `SELECT * FROM ${TABLE_NAME.CHANT} 
                    WHERE address = ? AND state = ?
                    ORDER BY timestamp ${order} 
                    LIMIT ? OFFSET ?`
                );
                list = pageStmt.all(address, InscriptionOpState.OK, limit, offset);
            }

            logger.debug('queryChantByAddress:', address, offset, limit, "ret:", count, list);

            return makeSuccessReponse({ count, list });
        } catch (error) {
            logger.error('queryChantByAddress failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }
}

module.exports = {
    InscribeStore
};