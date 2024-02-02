const { TABLE_NAME } = require('./store');
const { ERR_CODE, makeResponse, makeSuccessResponse } = require('./util');
const { InscriptionOpState, InscriptionStage } = require('../../token_index/ops/state');
const { Util, BigNumberUtil } = require('../../util');
const { UserHashRelation } = require('../../storage/relation')
const { UserOp } = require('../../storage/token');
const { InscriptionOp } = require('../../index/item');
const { BalanceRecordTokenType, BalanceRecordDirection } = require('../../storage/balance');

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

class OpsStore {
    constructor(config, store) {
        this.m_config = config;
        this.m_store = store;
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
            const countStmt = this.m_store.indexDB.prepare(sql);
            const countResult = countStmt.get(address);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.USER_OPS} WHERE address = ?`;
                sql += StateCondition(state);
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = this.m_store.indexDB.prepare(sql);
                list = pageStmt.all(address, limit, offset);

                for (const item of list) {
                    const balanceSql =
                        `SELECT * FROM ${TABLE_NAME.BALANCE_RECORDS}
                        WHERE address = ?
                        AND inscription_id = ?
                        AND block_height = ?`;

                    const balanceStmt = this.m_store.indexDB.prepare(balanceSql);
                    const balanceList = balanceStmt.all(
                        item.address,
                        item.inscription_id,
                        item.block_height
                    );

                    let amount = '0';
                    let inner_amount = '0';

                    for (const balanceItem of balanceList) {
                        if (balanceItem.token_type == BalanceRecordTokenType.Default) {
                            amount = BigNumberUtil.add(amount, balanceItem.change_amount);
                        } else {
                            inner_amount = BigNumberUtil.add(inner_amount, balanceItem.change_amount);
                        }
                    }

                    item.amount_change = amount;
                    item.inner_amount_change = inner_amount;

                    const hashSql =
                        `SELECT hash FROM ${TABLE_NAME.DATA_OPS}
                        WHERE inscription_id = ? AND block_height = ? limit 1`;
                    const hashStmt = this.m_store.indexDB.prepare(hashSql);
                    const hashResult = hashStmt.get(item.inscription_id, item.block_height);
                    if (hashResult) {
                        item.hash = hashResult.hash;
                    }

                    // TODO lucky?
                }
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
            const countStmt = this.m_store.indexDB.prepare(sql);
            const countResult = countStmt.get(inscription);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.USER_OPS} WHERE inscription_id = ?`;
                sql += StateCondition(state);
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;

                const pageStmt = this.m_store.indexDB.prepare(sql);
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
            const countStmt = this.m_store.indexDB.prepare(sql);
            const countResult = countStmt.get(inscription, address);
            const count = countResult.count;

            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.USER_OPS} WHERE inscription_id = ? AND address = ?`;
                sql += StateCondition(state);
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;
                const pageStmt = this.m_store.indexDB.prepare(sql);
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

            const stmt = this.m_store.indexDB.prepare(sql);
            const ret = stmt.get(txid);

            logger.debug('queryOpsByTx:', txid, "ret:", ret);

            return ret ? makeSuccessResponse(ret) : makeResponse(ERR_CODE.NOT_FOUND, "not found");

        } catch (error) {
            logger.error('queryOpsByTx failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    queryDataOpByHash(hash, limit, offset, state, order) {
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
            let sql = `SELECT COUNT(*) AS count FROM ${TABLE_NAME.DATA_OPS} WHERE hash = ?`;
            sql += StateCondition(state);
            const countStmt = this.m_store.indexDB.prepare(sql);
            const countResult = countStmt.get(hash);

            const count = countResult.count;
            let list = [];
            if (count > 0) {
                sql = `SELECT * FROM ${TABLE_NAME.DATA_OPS} WHERE hash = ?`;
                sql += StateCondition(state);
                sql += ` ORDER BY timestamp ${order} LIMIT ? OFFSET ?`;
                const pageStmt = this.m_store.indexDB.prepare(sql);
                list = pageStmt.all(hash, limit, offset);
            }

            logger.debug('queryDataOpByHash:', hash, offset, limit, "ret:", count);

            return makeSuccessResponse({ count, list });

        } catch (error) {
            logger.error('queryDataOpByHash failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

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
            case UserOp.Resonance:
                return TABLE_NAME.RESONANCE_RECORDS;
            case UserOp.InscribeTransfer:
                return TABLE_NAME.TRANSFER_RECORDS;
            case UserOp.Transfer:
                return TABLE_NAME.TRANSFER_RECORDS;
            case UserOp.SetPrice:
                return TABLE_NAME.SET_PRICE_RECORDS;

            case InscriptionOp.Mint:
                return TABLE_NAME.MINT_RECORDS;
            case InscriptionOp.Transfer:
                return TABLE_NAME.TRANSFER_RECORDS;
            case InscriptionOp.Chant:
                return TABLE_NAME.CHANT_RECORDS;
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
    OpsStore
};