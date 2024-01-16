const { store, TABLE_NAME } = require('./store');
const { ERR_CODE, makeResponse, makeSuccessResponse } = require('./util');
const { InscriptionOpState, InscriptionStage } = require('../../token_index/ops/state');
const { Util } = require('../../util');
const { UserHashRelation } = require('../../storage/relation')
const { UserOp } = require('../../storage/token');
const { InscriptionOp } = require('../../index/item');

const SUCCESS = "success";
const FAILED = "failed";

function StateCondition(state) {
    if (state == SUCCESS) {
        return ` AND state = ${InscriptionOpState.OK}`;
    } else if (state == FAILED) {
        return ` AND state != ${InscriptionOpState.OK}`;
    }
    return '';
}

function StageCondition(stage) {
    if (stage == InscriptionStage.Inscribe) {
        return ` AND stage = '${InscriptionStage.Inscribe}'`;
    } else if (stage == InscriptionStage.Transfer) {
        return ` AND stage = '${InscriptionStage.Transfer}'`;
    }
    return '';
}

class InscribeStore {
    constructor(config) {
        this.m_config = config;
    }

    queryInscriptionByHash(hash) {
        if (!hash) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        const { valid, mixhash } = Util.check_and_fix_mixhash(hash);
        if (!valid) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        hash = mixhash;

        try {
            const stmt = store.indexDB.prepare(`SELECT * FROM ${TABLE_NAME.INSCRIBE_DATA} WHERE hash = ?`);
            const ret = stmt.get(hash);

            logger.debug('queryInscriptionByHash:', hash, "ret:", ret);

            if (ret) {
                return makeSuccessResponse(ret);
            }

            return makeResponse(ERR_CODE.NOT_FOUND, "not found");

        } catch (error) {
            logger.error('queryInscriptionByHash failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryInscriptionByAddress(address, limit, offset, order) {
        if (!address) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        order = order == "asc" ? "asc" : "desc";
        try {
            let list = [];
            const countStmt = store.indexDB.prepare(
                `SELECT COUNT(*) AS count 
                FROM ${TABLE_NAME.INSCRIBE_DATA} 
                WHERE address = ?`
            );
            const countResult = countStmt.get(address);
            const count = countResult.count;

            if (count > 0) {
                const pageStmt = store.indexDB.prepare(
                    `SELECT * FROM ${TABLE_NAME.INSCRIBE_DATA} 
                    WHERE address = ? 
                    ORDER BY timestamp ${order} LIMIT ? OFFSET ?`
                );
                list = pageStmt.all(address, limit, offset);
            }

            logger.debug('queryInscriptionByAddress:', address, offset, limit, "ret:", count, list);

            return makeSuccessResponse({ count, list });

        } catch (error) {
            logger.error('queryInscriptionByAddress failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }

    }

    //[begin, end)
    queryInscriptionByBlock(beginBlock, endBlock, limit, offset, order) {
        if (!beginBlock) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        order = order == "asc" ? "asc" : "desc";
        try {
            let list = [];
            const countStmt = store.indexDB.prepare(
                `SELECT COUNT(*) AS count 
                FROM ${TABLE_NAME.INSCRIBE_DATA} 
                WHERE block_height >= ? AND block_height < ?`
            );
            const countResult = countStmt.get(beginBlock, endBlock);
            const count = countResult.count;

            if (count > 0) {
                const pageStmt = store.indexDB.prepare(`SELECT * FROM ${TABLE_NAME.INSCRIBE_DATA} WHERE block_height >= ? AND block_height < ? ORDER BY timestamp ${order} LIMIT ? OFFSET ?`);
                list = pageStmt.all(beginBlock, endBlock, limit, offset);
            }

            logger.debug('queryInscriptionByBlock:', beginBlock, endBlock, offset, limit, "ret:", count, list);

            return makeSuccessResponse({ count, list });

        } catch (error) {
            logger.error('queryInscriptionByBlock failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryInscriptionCount() {
        try {
            const stmt = store.indexDB.prepare(
                `SELECT COUNT(*) AS count 
                FROM ${TABLE_NAME.INSCRIBE_DATA}`
            );
            const ret = stmt.get();
            const count = ret.count;

            logger.debug('queryInscriptionCount: ret:', count);

            return makeSuccessResponse(count);
        } catch (error) {
            logger.error('queryInscriptionCount failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryInscribeByHash(hash, limit, offset, state, order) {
        if (!hash) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        const { valid, mixhash } = Util.check_and_fix_mixhash(hash);
        if (!valid) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        hash = mixhash;

        order = order == "asc" ? "asc" : "desc";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count 
                FROM ${TABLE_NAME.INSCRIBE_RECORDS} 
                WHERE hash = ?`;

            sql += StateCondition(state);

            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(hash);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.INSCRIBE_RECORDS} WHERE hash = ?`;
                sql += StateCondition(state);
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(hash, limit, offset);
            }

            logger.debug('queryInscribeByHash:', hash, offset, limit, state, "ret:", count);
            return makeSuccessResponse({ count, list });

        } catch (error) {
            logger.error('queryInscribeByHash failed:', error);
            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryInscribeByAddress(address, limit, offset, state, order) {
        if (!address) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        order = order == "asc" ? "asc" : "desc";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.INSCRIBE_RECORDS} 
                WHERE address = ?`;
            sql += StateCondition(state);
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(address);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.INSCRIBE_RECORDS} WHERE address = ?`;
                sql += StateCondition(state);
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(address, limit, offset);
            }

            logger.debug('queryInscribeByAddress:', address, offset, limit, state, "ret:", count);
            return makeSuccessResponse({ count, list });

        } catch (error) {
            logger.error('queryInscribeByAddress failed:', error);
            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryInscribeByHashAndAddress(hash, address, limit, offset, state, order) {
        if (!hash || !address) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        const { valid, mixhash } = Util.check_and_fix_mixhash(hash);
        if (!valid) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        hash = mixhash;

        order = order == "asc" ? "asc" : "desc";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.INSCRIBE_RECORDS}
                WHERE hash = ? AND address = ?`;
            sql += StateCondition(state);
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(hash, address);
            const count = countResult.count;

            if (count > 0) {
                sql =
                    `SELECT * FROM ${TABLE_NAME.INSCRIBE_RECORDS} 
                    WHERE hash = ? AND address = ?`;
                sql += StateCondition(state);
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(hash, address, limit, offset);
            }

            logger.debug('queryInscribeByHashAndAddress:', hash, address, offset, limit, state, "ret:", count);
            return makeSuccessResponse({ count, list });

        } catch (error) {
            logger.error('queryInscribeByHashAndAddress failed:', error);
            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryInscribeByTx(txid) {
        if (!txid) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        try {
            let sql =
                `SELECT *
                FROM ${TABLE_NAME.INSCRIBE_RECORDS} 
                WHERE txid = ?`;

            const stmt = store.indexDB.prepare(sql);
            const ret = stmt.get(txid);

            logger.debug('queryInscribeByTx:', txid, "ret:", ret);

            return ret ? makeSuccessResponse(ret) : makeResponse(ERR_CODE.NOT_FOUND, "not found");

        } catch (error) {
            logger.error('queryInscribeByTx failed:', error);
            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryResonanceByHash(hash, limit, offset, state, order) {
        if (!hash) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        const { valid, mixhash } = Util.check_and_fix_mixhash(hash);
        if (!valid) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        hash = mixhash;

        order = order == "asc" ? "asc" : "desc";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.RESONANCE_RECORDS}
                WHERE hash = ?`;
            sql += StateCondition(state);
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(hash);
            const count = countResult.count;
            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.RESONANCE_RECORDS} WHERE hash = ?`;
                sql += StateCondition(state);
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(hash, limit, offset);
            }

            logger.debug('queryResonanceByHash:', hash, offset, limit, "ret:", count);

            return makeSuccessResponse({ count, list });
        } catch (error) {
            logger.error('queryResonanceByHash failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryResonanceByAddress(address, limit, offset, state, order, stage) {
        if (!address) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        order = order == "asc" ? "asc" : "desc";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.RESONANCE_RECORDS}
                WHERE address = ?`;
            sql += StateCondition(state);
            sql += StageCondition(stage);
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(address);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.RESONANCE_RECORDS} WHERE address = ?`;
                sql += StateCondition(state);
                sql += StageCondition(stage);
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(address, limit, offset);
            }

            logger.debug('queryResonanceByAddress:', address, offset, limit, "ret:", count, list);

            return makeSuccessResponse({ count, list });

        } catch (error) {
            logger.error('queryResonanceByAddress failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryResonanceByHashAndAddress(hash, address, limit, offset, state, order) {
        if (!hash || !address) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        const { valid, mixhash } = Util.check_and_fix_mixhash(hash);
        if (!valid) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        hash = mixhash;

        order = order == "asc" ? "asc" : "desc";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.RESONANCE_RECORDS}
                WHERE hash = ? AND address = ?`;
            sql += StateCondition(state);
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(hash, address);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.RESONANCE_RECORDS} WHERE hash = ? AND address = ?`;
                sql += StateCondition(state);
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(hash, address, limit, offset);
            }

            logger.debug('queryResonanceByHashAndAddress:', hash, address, offset, limit, "ret:", count);

            return makeSuccessResponse({ count, list });

        } catch (error) {
            logger.error('queryResonanceByHashAndAddress failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryResonanceByTx(txid) {
        if (!txid) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        try {
            let sql =
                `SELECT *
                FROM ${TABLE_NAME.RESONANCE_RECORDS}
                WHERE txid = ?`;

            const stmt = store.indexDB.prepare(sql);
            const ret = stmt.get(txid);

            logger.debug('queryResonanceByTx:', txid, "ret:", ret);

            return ret ? makeSuccessResponse(ret) : makeResponse(ERR_CODE.NOT_FOUND, "not found");

        } catch (error) {
            logger.error('queryResonanceByTx failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryChantByHash(hash, limit, offset, state, order) {
        if (!hash) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        const { valid, mixhash } = Util.check_and_fix_mixhash(hash);
        if (!valid) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        hash = mixhash;

        order = order == "asc" ? "asc" : "desc";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.CHANT_RECORDS}
                WHERE hash = ?`;
            sql += StateCondition(state);
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(hash);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.CHANT_RECORDS} WHERE hash = ?`;
                sql += StateCondition(state);
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(hash, limit, offset);
            }

            logger.debug('queryChantByHash:', hash, offset, limit, "ret:", count);

            return makeSuccessResponse({ count, list });

        } catch (error) {
            logger.error('queryChantByHash failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryChantByAddress(address, limit, offset, state, order) {
        if (!address) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        order = order == "asc" ? "asc" : "desc";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.CHANT_RECORDS}
                WHERE address = ?`;
            sql += StateCondition(state);
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(address);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.CHANT_RECORDS} WHERE address = ?`;
                sql += StateCondition(state);
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(address, limit, offset);
            }

            logger.debug('queryChantByAddress:', address, offset, limit, "ret:", count);

            return makeSuccessResponse({ count, list });
        } catch (error) {
            logger.error('queryChantByAddress failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryChantByHashAndAddress(hash, address, limit, offset, state, order) {
        if (!hash || !address) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        const { valid, mixhash } = Util.check_and_fix_mixhash(hash);
        if (!valid) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        hash = mixhash;

        order = order == "asc" ? "asc" : "desc";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.CHANT_RECORDS}
                WHERE hash = ? AND address = ?`;
            sql += StateCondition(state);
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(hash, address);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.CHANT_RECORDS} WHERE hash = ? AND address = ?`;
                sql += StateCondition(state);
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(hash, address, limit, offset);
            }

            logger.debug('queryChantByHashAndAddress:', hash, address, offset, limit, "ret:", count);

            return makeSuccessResponse({ count, list });

        } catch (error) {
            logger.error('queryChantByHashAndAddress failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }


    queryChantByTx(txid) {
        if (!txid) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        try {
            let sql =
                `SELECT *
                FROM ${TABLE_NAME.CHANT_RECORDS}
                WHERE txid = ?`;

            const stmt = store.indexDB.prepare(sql);
            const ret = stmt.get(txid);

            logger.debug('queryChantByTx:', txid, "ret:", ret);

            return ret ? makeSuccessResponse(ret) : makeResponse(ERR_CODE.NOT_FOUND, "not found");

        } catch (error) {
            logger.error('queryChantByTx failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    querySetPriceByHash(hash, limit, offset, state, order) {
        if (!hash) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        const { valid, mixhash } = Util.check_and_fix_mixhash(hash);
        if (!valid) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        hash = mixhash;

        order = order == "asc" ? "asc" : "desc";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.SET_PRICE_RECORDS}
                WHERE hash = ?`;
            sql += StateCondition(state);
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(hash);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.SET_PRICE_RECORDS} WHERE hash = ?`;
                sql += StateCondition(state);
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(hash, limit, offset);
            }

            logger.debug('querySetPriceByHash:', hash, offset, limit, "ret:", count);

            return makeSuccessResponse({ count, list });

        } catch (error) {
            logger.error('querySetPriceByHash failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    querySetPriceByAddress(address, limit, offset, state, order) {
        if (!address) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        order = order == "asc" ? "asc" : "desc";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.SET_PRICE_RECORDS}
                WHERE address = ?`;
            sql += StateCondition(state);
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(address);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.SET_PRICE_RECORDS} WHERE address = ?`;
                sql += StateCondition(state);
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(address, limit, offset);
            }

            logger.debug('querySetPriceByAddress:', address, offset, limit, "ret:", count);

            return makeSuccessResponse({ count, list });

        } catch (error) {
            logger.error('querySetPriceByAddress failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    querySetPriceByTx(txid) {
        if (!txid) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        try {
            let sql =
                `SELECT *
                FROM ${TABLE_NAME.SET_PRICE_RECORDS}
                WHERE txid = ?`;

            const stmt = store.indexDB.prepare(sql);
            const ret = stmt.get(txid);

            logger.debug('querySetPriceByTx:', txid, "ret:", ret);

            return ret ? makeSuccessResponse(ret) : makeResponse(ERR_CODE.NOT_FOUND, "not found");

        } catch (error) {
            logger.error('querySetPriceByTx failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryTransferByAddress(address, limit, offset, state, order, stage) {
        if (!address) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        order = order == "asc" ? "asc" : "desc";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.TRANSFER_RECORDS}
                WHERE from_address = ? OR to_address = ?`;
            sql += StateCondition(state);
            sql += StageCondition(stage);
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(address, address);
            const count = countResult.count;

            if (count > 0) {
                sql =
                    `SELECT * FROM ${TABLE_NAME.TRANSFER_RECORDS} 
                    WHERE from_address = ? OR to_address = ?`;
                sql += StateCondition(state);
                sql += StageCondition(stage);
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(address, address, limit, offset);
            }

            logger.debug('queryTransferByAddress:', address, offset, limit, "ret:", count);

            return makeSuccessResponse({ count, list });

        } catch (error) {
            logger.error('queryTransferByAddress failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryTransferByTx(txid) {
        if (!txid) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        try {
            let sql =
                `SELECT *
                FROM ${TABLE_NAME.TRANSFER_RECORDS}
                WHERE txid = ?`;

            const stmt = store.indexDB.prepare(sql);
            const ret = stmt.get(txid);

            logger.debug('queryTransferByTx:', txid, "ret:", ret);

            return ret ? makeSuccessResponse(ret) : makeResponse(ERR_CODE.NOT_FOUND, "not found");

        } catch (error) {
            logger.error('queryTransferByTx failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryInscribeDataTransferByHash(hash, limit, offset, state, order) {
        if (!hash) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        const { valid, mixhash } = Util.check_and_fix_mixhash(hash);
        if (!valid) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        hash = mixhash;

        order = order == "asc" ? "asc" : "desc";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.INSCRIBE_DATA_TRANSFER_RECORDS}
                WHERE hash = ?`;
            sql += StateCondition(state);
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(hash);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.INSCRIBE_DATA_TRANSFER_RECORDS} WHERE hash = ?`;
                sql += StateCondition(state);
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(hash, limit, offset);
            }

            logger.debug('queryInscribeDataTransferByHash:', hash, offset, limit, "ret:", count);

            return makeSuccessResponse({ count, list });

        } catch (error) {
            logger.error('queryInscribeDataTransferByHash failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryInscribeDataTransferByAddress(address, limit, offset, state, order) {
        if (!address) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        order = order == "asc" ? "asc" : "desc";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.INSCRIBE_DATA_TRANSFER_RECORDS}
                WHERE from_address = ? OR to_address = ?`;
            sql += StateCondition(state);
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(address, address);
            const count = countResult.count;

            if (count > 0) {
                sql =
                    `SELECT * FROM ${TABLE_NAME.INSCRIBE_DATA_TRANSFER_RECORDS} 
                    WHERE from_address = ? OR to_address = ?`;
                sql += StateCondition(state);
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(address, address, limit, offset);
            }

            logger.debug('queryInscribeDataTransferByAddress:', address, offset, limit, "ret:", count);

            return makeSuccessResponse({ count, list });

        } catch (error) {
            logger.error('queryInscribeDataTransferByAddress failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryInscribeDataTransferByTx(txid) {
        if (!txid) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        try {
            let sql =
                `SELECT *
                FROM ${TABLE_NAME.INSCRIBE_DATA_TRANSFER_RECORDS}
                WHERE txid = ?`;

            const stmt = store.indexDB.prepare(sql);
            const ret = stmt.get(txid);

            logger.debug('queryInscribeDataTransferByTx:', txid, "ret:", ret);

            return ret ? makeSuccessResponse(ret) : makeResponse(ERR_CODE.NOT_FOUND, "not found");

        } catch (error) {
            logger.error('queryInscribeDataTransferByTx failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryOpsByAddress(address, limit, offset, state, order) {
        if (!address) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        order = order == "asc" ? "asc" : "desc";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.USER_OPS}
                WHERE address = ?`;
            sql += StateCondition(state);
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(address);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.USER_OPS} WHERE address = ?`;
                sql += StateCondition(state);
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(address, limit, offset);
            }

            logger.debug('queryOpsByAddress:', address, offset, limit, "ret:", count);

            return makeSuccessResponse({ count, list });

        } catch (error) {
            logger.error('queryOpsByAddress failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryOpsByInscription(inscription, limit, offset, state, order) {
        if (!inscription) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        order = order == "asc" ? "asc" : "desc";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.USER_OPS}
                WHERE inscription_id = ?`;
            sql += StateCondition(state);
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(inscription);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.USER_OPS} WHERE inscription_id = ?`;
                sql += StateCondition(state);
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(inscription, limit, offset);
            }

            logger.debug('queryOpsByInscription:', inscription, offset, limit, "ret:", count);

            return makeSuccessResponse({ count, list });

        } catch (error) {
            logger.error('queryOpsByInscription failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryOpsByInscriptionAndAddress(inscription, address, limit, offset, state, order) {
        if (!inscription || !address) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        order = order == "asc" ? "asc" : "desc";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.USER_OPS}
                WHERE inscription_id = ? AND address = ?`;
            sql += StateCondition(state);
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(inscription, address);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.USER_OPS} WHERE inscription_id = ? AND address = ?`;
                sql += StateCondition(state);
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;
                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(inscription, address, limit, offset);
            }

            logger.debug('queryOpsByInscriptionAndAddress:', inscription, address, offset, limit, "ret:", count);

            return makeSuccessResponse({ count, list });

        } catch (error) {
            logger.error('queryOpsByInscriptionAndAddress failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryOpsByTx(txid) {
        if (!txid) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        try {
            let sql =
                `SELECT *
                FROM ${TABLE_NAME.USER_OPS}
                WHERE txid = ?`;

            const stmt = store.indexDB.prepare(sql);
            const ret = stmt.get(txid);

            logger.debug('queryOpsByTx:', txid, "ret:", ret);

            return ret ? makeSuccessResponse(ret) : makeResponse(ERR_CODE.NOT_FOUND, "not found");

        } catch (error) {
            logger.error('queryOpsByTx failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryRelationByAddress(address) {
        if (!address) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        try {
            let list = [];
            let sql =
                `SELECT * FROM ${TABLE_NAME.RELATIONS} 
                    WHERE address = ? AND relation = ?`;
            const pageStmt = store.indexDB.prepare(sql);
            list = pageStmt.all(address, UserHashRelation.Resonance);

            return makeSuccessResponse(list);

        } catch (error) {
            logger.error('queryRelationByAddress failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryRelationByHash(hash) {
        if (!hash) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        const { valid, mixhash } = Util.check_and_fix_mixhash(hash);
        if (!valid) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        hash = mixhash;

        try {
            let list = [];
            let sql =
                `SELECT * FROM ${TABLE_NAME.RELATIONS} 
                    WHERE hash = ? AND relation = ?`;
            const pageStmt = store.indexDB.prepare(sql);
            list = pageStmt.all(hash, UserHashRelation.Resonance);

            return makeSuccessResponse(list);

        } catch (error) {
            logger.error('queryRelationByHash failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    async queryVerifyRelationByAddress(address) {
        try {
            const url = `http://localhost:${this.m_config.localInterface.port}/resonance/address/${address}`;
            const response = await fetch(url);

            if (response.status != 200) {
                return makeResponse(ERR_CODE.UNKNOWN_ERROR, response.statusText);
            }

            const json = await response.json();
            console.log(json);

            return makeSuccessResponse(json);

        } catch (error) {
            logger.error('queryVerifyRelationByAddress failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    async queryVerifyRelationByHash(hash) {
        try {
            const url = `http://localhost:${this.m_config.localInterface.port}/resonance/hash/${hash}`;
            const response = await fetch(url);

            if (response.status != 200) {
                return makeResponse(ERR_CODE.UNKNOWN_ERROR, response.statusText);
            }

            const json = await response.json();
            console.log(json);

            return makeSuccessResponse(json);

        } catch (error) {
            logger.error('queryVerifyRelationByAddress failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryInscriptionOpById(inscriptionId) {
        if (!inscriptionId) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        try {
            let sql =
                `SELECT *
                FROM ${TABLE_NAME.INSCRIPTION_OP}
                WHERE inscription_id = ?`;

            const stmt = store.inscriptionOpDB.prepare(sql);
            const ret = stmt.get(inscriptionId);

            if (!ret) {
                return makeResponse(ERR_CODE.NOT_FOUND);
            }

            const opType = ret.op;
            const tableName = this._getTableByOpType(opType);
            if (!tableName) {
                return makeResponse(ERR_CODE.NOT_FOUND);
            }

            sql = `SELECT * FROM ${tableName} WHERE inscription_id = ? LIMIT 1`;
            const opStmt = store.indexDB.prepare(sql);
            ret.detail = opStmt.get(inscriptionId);

            return makeSuccessResponse(ret);

        } catch (error) {
            logger.error('queryInscriptionOpById failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    /*
    const UserOp = {
        Mint: 'mint',
        Chant: 'chant',

        InscribeData: 'inscribe_data',
        TransferData: 'transfer_data',

        InscribeResonance: 'inscribe_res',
        Resonance: 'res',

        InscribeTransfer: 'inscribe_transfer',
        Transfer: 'transfer',

        SetPrice: 'set_price',
    }; */
    _getTableByOpType(opType) {
        switch (opType) {
            case UserOp.Mint:
                return TABLE_NAME.MINT_RECORDS;
            case UserOp.Chant:
                return TABLE_NAME.CHANT_RECORDS;
            case UserOp.InscribeData:
                return TABLE_NAME.INSCRIBE_RECORDS;
            case UserOp.TransferData:
                return TABLE_NAME.INSCRIBE_DATA_TRANSFER_RECORDS;
            case UserOp.InscribeResonance:
                return TABLE_NAME.RESONANCE_RECORDS;
            case UserOp.Resonance:
                return TABLE_NAME.RESONANCE_RECORDS;
            case UserOp.InscribeTransfer:
                return TABLE_NAME.TRANSFER_RECORDS;
            case UserOp.Transfer:
                return TABLE_NAME.TRANSFER_RECORDS;
            case UserOp.SetPrice:
                return TABLE_NAME.SET_PRICE_RECORDS;

            case InscriptionOp.Inscribe:
                return TABLE_NAME.INSCRIBE_RECORDS;
            case InscriptionOp.SetPrice:
                return TABLE_NAME.SET_PRICE_RECORDS;
            case InscriptionOp.Resonance:
                return TABLE_NAME.RESONANCE_RECORDS;

            default:
                return null;
        }
    }
}

module.exports = {
    InscribeStore
};