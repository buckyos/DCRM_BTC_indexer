const { store, TABLE_NAME } = require('./store');
const { ERR_CODE, makeReponse, makeSuccessReponse } = require('./util');
const { InscriptionOpState, InscriptionStage } = require('../../token_index/ops/state');

const SUCCESS = "SUCCESS";
const FAILED = "FAILED";

class InscribeStore {
    constructor() {
    }

    // return null or data
    queryInscriptionByHash(hash) {
        if (!hash) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        try {
            const stmt = store.indexDB.prepare(`SELECT * FROM ${TABLE_NAME.INSCRIBE_DATA} WHERE hash = ?`);
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

            return makeSuccessReponse({ count, list });

        } catch (error) {
            logger.error('queryInscriptionByBlock failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
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

            return makeSuccessReponse(count);
        } catch (error) {
            logger.error('queryInscriptionCount failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    queryInscribeByHash(hash, limit, offset, state, order) {
        if (!hash) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        order = order == "ASC" ? "ASC" : "DESC";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count 
                FROM ${TABLE_NAME.INSCRIBE_RECORDS} 
                WHERE hash = ?`;
            if (state == SUCCESS) {
                sql += " AND state = 0";
            } else if (state == FAILED) {
                sql += " AND state != 0";
            }
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(hash);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.INSCRIBE_RECORDS} WHERE hash = ?`;
                if (state == SUCCESS) {
                    sql += " AND state = 0";
                } else if (state == FAILED) {
                    sql += " AND state != 0";
                }
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(hash, limit, offset);
            }

            logger.debug('queryInscribeByHash:', hash, offset, limit, state, "ret:", count);
            return makeSuccessReponse({ count, list });

        } catch (error) {
            logger.error('queryInscribeByHash failed:', error);
            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    queryInscribeByAddress(address, limit, offset, state, order) {
        if (!address) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        order = order == "ASC" ? "ASC" : "DESC";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.INSCRIBE_RECORDS} 
                WHERE address = ?`;
            if (state == SUCCESS) {
                sql += " AND state = 0";
            } else if (state == FAILED) {
                sql += " AND state != 0";
            }
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(address);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.INSCRIBE_RECORDS} WHERE address = ?`;
                if (state == SUCCESS) {
                    sql += " AND state = 0";
                } else if (state == FAILED) {
                    sql += " AND state != 0";
                }
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(address, limit, offset);
            }

            logger.debug('queryInscribeByAddress:', address, offset, limit, state, "ret:", count);
            return makeSuccessReponse({ count, list });

        } catch (error) {
            logger.error('queryInscribeByAddress failed:', error);
            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    queryInscribeByTx(txid) {
        if (!txid) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        try {
            let sql =
                `SELECT *
                FROM ${TABLE_NAME.INSCRIBE_RECORDS} 
                WHERE txid = ?`;

            const stmt = store.indexDB.prepare(sql);
            const ret = stmt.get(txid);

            logger.debug('queryInscribeByTx:', txid, "ret:", ret);

            return ret ? makeSuccessReponse(ret) : makeReponse(ERR_CODE.NOT_FOUND, "not found");

        } catch (error) {
            logger.error('queryInscribeByTx failed:', error);
            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    queryResonanceByHash(hash, limit, offset, state, order) {
        if (!hash) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        order = order == "ASC" ? "ASC" : "DESC";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.RESONANCE_RECORDS}
                WHERE hash = ?`;
            if (state == SUCCESS) {
                sql += ` AND state = ${InscriptionOpState.OK}`;
            } else if (state == FAILED) {
                sql += ` AND state != ${InscriptionOpState.OK}`;
            }
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(hash);
            const count = countResult.count;
            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.RESONANCE_RECORDS} WHERE hash = ?`;
                if (state == SUCCESS) {
                    sql += ` AND state = ${InscriptionOpState.OK}`;
                } else if (state == FAILED) {
                    sql += ` AND state != ${InscriptionOpState.OK}`;
                }
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(hash, limit, offset);
            }

            logger.debug('queryResonanceByHash:', hash, offset, limit, "ret:", count);

            return makeSuccessReponse({ count, list });
        } catch (error) {
            logger.error('queryResonanceByHash failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    queryResonanceByAddress(address, limit, offset, state, order) {
        if (!address) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        order = order == "ASC" ? "ASC" : "DESC";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.RESONANCE_RECORDS}
                WHERE address = ?`;
            if (state == SUCCESS) {
                sql += ` AND state = ${InscriptionOpState.OK}`;
            } else if (state == FAILED) {
                sql += ` AND state != ${InscriptionOpState.OK}`;
            }
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(address);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.RESONANCE_RECORDS} WHERE address = ?`;
                if (state == SUCCESS) {
                    sql += ` AND state = ${InscriptionOpState.OK}`;
                } else if (state == FAILED) {
                    sql += ` AND state != ${InscriptionOpState.OK}`;
                }
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(address, limit, offset);
            }

            logger.debug('queryResonanceByAddress:', address, offset, limit, "ret:", count, list);

            return makeSuccessReponse({ count, list });

        } catch (error) {
            logger.error('queryResonanceByAddress failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    queryResonanceByTx(txid) {
        if (!txid) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        try {
            let sql =
                `SELECT *
                FROM ${TABLE_NAME.RESONANCE_RECORDS}
                WHERE txid = ?`;

            const stmt = store.indexDB.prepare(sql);
            const ret = stmt.get(txid);

            logger.debug('queryResonanceByTx:', txid, "ret:", ret);

            return ret ? makeSuccessReponse(ret) : makeReponse(ERR_CODE.NOT_FOUND, "not found");

        } catch (error) {
            logger.error('queryResonanceByTx failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    queryChantByHash(hash, limit, offset, state, order) {
        if (!hash) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        order = order == "ASC" ? "ASC" : "DESC";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.CHANT_RECORDS}
                WHERE hash = ?`;
            if (state == SUCCESS) {
                sql += ` AND state = ${InscriptionOpState.OK}`;
            } else if (state == FAILED) {
                sql += ` AND state != ${InscriptionOpState.OK}`;
            }
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(hash);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.CHANT_RECORDS} WHERE hash = ?`;
                if (state == SUCCESS) {
                    sql += ` AND state = ${InscriptionOpState.OK}`;
                } else if (state == FAILED) {
                    sql += ` AND state != ${InscriptionOpState.OK}`;
                }
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(hash, limit, offset);
            }

            logger.debug('queryChantByHash:', hash, offset, limit, "ret:", count);

            return makeSuccessReponse({ count, list });

        } catch (error) {
            logger.error('queryChantByHash failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    queryChantByAddress(address, limit, offset, state, order) {
        if (!address) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        order = order == "ASC" ? "ASC" : "DESC";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.CHANT_RECORDS}
                WHERE address = ?`;
            if (state == SUCCESS) {
                sql += ` AND state = ${InscriptionOpState.OK}`;
            } else if (state == FAILED) {
                sql += ` AND state != ${InscriptionOpState.OK}`;
            }
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(address);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.CHANT_RECORDS} WHERE address = ?`;
                if (state == SUCCESS) {
                    sql += ` AND state = ${InscriptionOpState.OK}`;
                } else if (state == FAILED) {
                    sql += ` AND state != ${InscriptionOpState.OK}`;
                }
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(address, limit, offset);
            }

            logger.debug('queryChantByAddress:', address, offset, limit, "ret:", count);

            return makeSuccessReponse({ count, list });
        } catch (error) {
            logger.error('queryChantByAddress failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    queryChantByTx(txid) {
        if (!txid) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        try {
            let sql =
                `SELECT *
                FROM ${TABLE_NAME.CHANT_RECORDS}
                WHERE txid = ?`;

            const stmt = store.indexDB.prepare(sql);
            const ret = stmt.get(txid);

            logger.debug('queryChantByTx:', txid, "ret:", ret);

            return ret ? makeSuccessReponse(ret) : makeReponse(ERR_CODE.NOT_FOUND, "not found");

        } catch (error) {
            logger.error('queryChantByTx failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    querySetPriceByHash(hash, limit, offset, state, order) {
        if (!hash) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        order = order == "ASC" ? "ASC" : "DESC";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.SET_PRICE_RECORDS}
                WHERE hash = ?`;
            if (state == SUCCESS) {
                sql += ` AND state = ${InscriptionOpState.OK}`;
            } else if (state == FAILED) {
                sql += ` AND state != ${InscriptionOpState.OK}`;
            }
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(hash);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.SET_PRICE_RECORDS} WHERE hash = ?`;
                if (state == SUCCESS) {
                    sql += ` AND state = ${InscriptionOpState.OK}`;
                } else if (state == FAILED) {
                    sql += ` AND state != ${InscriptionOpState.OK}`;
                }
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(hash, limit, offset);
            }

            logger.debug('querySetPriceByHash:', hash, offset, limit, "ret:", count);

            return makeSuccessReponse({ count, list });

        } catch (error) {
            logger.error('querySetPriceByHash failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    querySetPriceByAddress(address, limit, offset, state, order) {
        if (!address) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        order = order == "ASC" ? "ASC" : "DESC";

        try {
            let list = [];
            let sql =
                `SELECT COUNT(*) AS count
                FROM ${TABLE_NAME.SET_PRICE_RECORDS}
                WHERE address = ?`;
            if (state == SUCCESS) {
                sql += ` AND state = ${InscriptionOpState.OK}`;
            } else if (state == FAILED) {
                sql += ` AND state != ${InscriptionOpState.OK}`;
            }
            const countStmt = store.indexDB.prepare(sql);
            const countResult = countStmt.get(address);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.SET_PRICE_RECORDS} WHERE address = ?`;
                if (state == SUCCESS) {
                    sql += ` AND state = ${InscriptionOpState.OK}`;
                } else if (state == FAILED) {
                    sql += ` AND state != ${InscriptionOpState.OK}`;
                }
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = store.indexDB.prepare(sql);
                list = pageStmt.all(address, limit, offset);
            }

            logger.debug('querySetPriceByAddress:', address, offset, limit, "ret:", count);

            return makeSuccessReponse({ count, list });

        } catch (error) {
            logger.error('querySetPriceByAddress failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }

    querySetPriceByTx(txid) {
        if (!txid) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        try {
            let sql =
                `SELECT *
                FROM ${TABLE_NAME.SET_PRICE_RECORDS}
                WHERE txid = ?`;

            const stmt = store.indexDB.prepare(sql);
            const ret = stmt.get(txid);

            logger.debug('querySetPriceByTx:', txid, "ret:", ret);

            return ret ? makeSuccessReponse(ret) : makeReponse(ERR_CODE.NOT_FOUND, "not found");

        } catch (error) {
            logger.error('querySetPriceByTx failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }
}

module.exports = {
    InscribeStore
};