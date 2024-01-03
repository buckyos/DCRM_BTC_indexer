const { store, TABLE_NAME } = require('./store');
const { ERR_CODE, makeReponse, makeSuccessReponse } = require('./util');
const { InscriptionOpState, InscriptionStage } = require('../../index/ops/state');

class SearchStore {
    constructor() {
    }

    queryByTxid(txid) {
        if (!txid) {
            return makeReponse(ERR_CODE.INVALID_PARAM, "invalid param");
        }

        try {
            let stmt = store.indexDB.prepare(`SELECT * FROM ${TABLE_NAME.MINT_RECORDS} WHERE txid = ?`);
            let ret = stmt.get(txid);

            logger.debug('queryByTxid:', txid, " find mint records, ret:", ret);
            if (ret) {
                ret.type = "mint";
                return makeSuccessReponse(ret);
            }

            stmt = store.indexDB.prepare(`SELECT * FROM ${TABLE_NAME.INSCRIBE_RECORDS} WHERE txid = ?`);
            ret = stmt.get(txid);
            logger.debug('queryByTxid:', txid, " find inscribe records, ret:", ret);
            if (ret) {
                ret.type = "inscribe";
                return makeSuccessReponse(ret);
            }

            stmt = store.indexDB.prepare(`SELECT * FROM ${TABLE_NAME.RESONANCE_RECORDS} WHERE txid = ?`);
            ret = stmt.get(txid);
            logger.debug('queryByTxid:', txid, " find resonance records, ret:", ret);
            if (ret) {
                ret.type = "resonance";
                return makeSuccessReponse(ret);
            }

            stmt = store.indexDB.prepare(`SELECT * FROM ${TABLE_NAME.CHANT_RECORDS} WHERE txid = ?`);
            ret = stmt.get(txid);
            logger.debug('queryByTxid:', txid, " find chant records, ret:", ret);
            if (ret) {
                ret.type = "chant";
                return makeSuccessReponse(ret);
            }

            stmt = store.indexDB.prepare(`SELECT * FROM ${TABLE_NAME.TRANSFER_RECORDS} WHERE txid = ?`);
            ret = stmt.get(txid);
            logger.debug('queryByTxid:', txid, " find transfer records, ret:", ret);
            if (ret) {
                ret.type = "transfer";
                return makeSuccessReponse(ret);
            }

            stmt = store.indexDB.prepare(`SELECT * FROM ${TABLE_NAME.SET_PRICE_RECORDS} WHERE txid = ?`);
            ret = stmt.get(txid);
            logger.debug('queryByTxid:', txid, " find set price records, ret:", ret);
            if (ret) {
                ret.type = "set_price";
                return makeSuccessReponse(ret);
            }

            return makeReponse(ERR_CODE.NOT_FOUND, "not found");

        } catch (error) {
            logger.error('queryByTxid failed:', error);

            return makeReponse(ERR_CODE.DB_ERROR, error);
        }
    }
}

module.exports = {
    SearchStore
}

