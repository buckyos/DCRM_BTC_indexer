const { TABLE_NAME } = require('./store');
const { ERR_CODE, makeResponse, makeSuccessResponse } = require('./util');
const { InscriptionOpState, InscriptionStage } = require('../../token_index/ops/state');
const { BalanceRecordTokenType, BalanceRecordDirection } = require('../../storage/balance');
const { Util, BigNumberUtil } = require('../../util');

class SearchStore {
    constructor(store) {
        this.m_store = store;
    }

    searchByTxid(txid) {
        try {
            let sql = `SELECT * FROM ${TABLE_NAME.USER_OPS} WHERE txid = ? limit 1`;
            let stmt = this.m_store.indexDB.prepare(sql);
            let ret = stmt.get(txid);

            if (!ret) {
                return null;
            }

            sql = `SELECT * FROM ${TABLE_NAME.BALANCE_RECORDS}
                WHERE address = ? AND inscription_id = ? AND block_height = ?`;
            stmt = this.m_store.indexDB.prepare(sql);
            const balanceRecords = stmt.all(
                ret.address,
                ret.inscription_id,
                ret.block_height);

            let amount = '0';
            let inner_amount = '0';

            for (const balanceItem of balanceRecords) {
                if (balanceItem.token_type == BalanceRecordTokenType.Default) {
                    amount = BigNumberUtil.add(amount, balanceItem.change_amount);
                } else {
                    inner_amount = BigNumberUtil.add(inner_amount, balanceItem.change_amount);
                }
            }

            ret.amount_change = amount;
            ret.inner_amount_change = inner_amount;

            sql = `SELECT * FROM ${TABLE_NAME.INSCRIPTIONS} WHERE inscription_id = ? limit 1`;
            stmt = this.m_store.inscriptionDB.prepare(sql);
            const inscription = stmt.get(ret.inscription_id);

            if (inscription) {
                ret.inscription_number = inscription.inscription_number;
                ret.content = inscription.content;
            }

            return ret;

        } catch (error) {
            logger.error('searchByTxid failed:', error);

            return null;
        }
    }

    searchByInscriptionIdOrNumber(str) {
        try {
            let sql =
                `SELECT * FROM ${TABLE_NAME.INSCRIPTIONS} 
                WHERE inscription_id = ? or inscription_number = ? limit 1`;
            let stmt = this.m_store.inscriptionDB.prepare(sql);
            let ret = stmt.get(str, str);

            if (ret) {
                sql =
                    `SELECT * FROM ${TABLE_NAME.INSCRIBE_DATA} 
                    WHERE inscription_id = ?`;

                stmt = this.m_store.indexDB.prepare(sql);
                const data = stmt.get(ret.inscription_id);
                if (data) {
                    for (const key in data) {
                        ret[key] = data[key];
                    }
                }
            }

            return ret;

        } catch (error) {
            logger.error('searchByInscriptionIdOrNumber failed:', error);

            return null;
        }
    }

    searchByHash(hash) {
        const { valid, mixhash } = Util.check_and_fix_mixhash(hash);
        if (!valid) {
            return null;
        }

        hash = mixhash;

        try {
            let sql =
                `SELECT * FROM ${TABLE_NAME.INSCRIBE_DATA} 
                WHERE hash = ? limit 1`;

            let stmt = this.m_store.indexDB.prepare(sql);
            let ret = stmt.get(hash);

            if (ret) {
                sql =
                    `SELECT * FROM ${TABLE_NAME.INSCRIPTIONS} 
                    WHERE inscription_id = ?`;

                stmt = this.m_store.inscriptionDB.prepare(sql);
                const inscription = stmt.get(ret.inscription_id);
                if (inscription) {
                    for (const key in inscription) {
                        ret[key] = inscription[key];
                    }
                }
            }

            return ret;

        } catch (error) {
            logger.error('searchByHash failed:', error);

            return null;
        }
    }

    search(str) {
        if (!str || str == "") {
            return makeResponse(ERR_CODE.INVALID_PARAMS);
        }

        let ret = this.searchByTxid(str);
        if (ret) {
            return makeSuccessResponse({
                type: 'tx',
                data: ret
            });
        }

        ret = this.searchByInscriptionIdOrNumber(str);
        if (ret) {
            return makeSuccessResponse({
                type: 'inscription',
                data: ret
            });
        }

        ret = this.searchByHash(str);
        if (ret) {
            return makeSuccessResponse({
                type: 'hash',
                data: ret
            });
        }

        return makeResponse(ERR_CODE.NOT_FOUND);
    }
}

module.exports = {
    SearchStore
}

