const assert = require('assert');
const { BTCClient } = require('../../btc/btc');
const { TABLE_NAME } = require('../biz/store');
const { Util, BigNumberUtil } = require('../../util');
const { DATA_HASH_START_SIZE } = require('../../constants');
const {
    BalanceRecordDirection,
    BalanceRecordTokenType,
    BalanceOp,
} = require('../../storage/balance');

class StatManager {
    constructor(store) {
        // TODO
        this.m_hashSizeList = {
            lastProcessBlock: 0,
            list: []
        };

        this.m_totalIncome = {} // {address: {lastUpdateBlock: stat:{income:{}, inner_income:{}} }}
        this.m_store = store;
    }

    init() {
    }

    async getLastSyncBlockHeight() {
        try {
            const btcStmt = this.m_store.indexStateDB.prepare(
                `SELECT value FROM ${TABLE_NAME.STATE} WHERE name = ?`,
            );
            const btcRet = btcStmt.get('token_latest_block_height');
            const btcHeight = btcRet.value;

            return btcHeight;

        } catch (error) {
            logger.error('get btc block height failed:', error);
        }

        return 0;
    }

    _default_stat_target() {
        const target = {};
        for (const key of Object.keys(BalanceOp)) {
            if (_.isString(BalanceOp[key])) {
                target[BalanceOp[key]] = '0';
            }
        }

        return target;
    }

    async getTotalIncomeByAddress(address) {
        const currentHeight = await this.getLastSyncBlockHeight();

        let stat = null;
        let lastUpdateBlock = 0;
        if (this.m_totalIncome[address]) {
            if (this.m_totalIncome[address].lastUpdateBlock >= currentHeight) {
                return this.m_totalIncome[address].stat;
            }
            stat = this.m_totalIncome[address].stat;
            lastUpdateBlock = this.m_totalIncome[address].lastUpdateBlock;
        }

        const sql =
            `SELECT * FROM ${TABLE_NAME.BALANCE_RECORDS} 
            WHERE address = ? 
            AND direction = ? 
            AND block_height > ? 
            AND block_height <= ?
            ORDER BY timestamp ASC`;

        try {
            const stmt = this.m_store.indexDB.prepare(sql);
            const list = stmt.all(
                address,
                BalanceRecordDirection.In,
                lastUpdateBlock,
                currentHeight
            );

            if (stat == null) {
                stat = {
                    income: this._default_stat_target(),
                    inner_income: this._default_stat_target(),
                };
            }

            for (const record of list) {
                let target;
                if (record.token_type == BalanceRecordTokenType.Default) {
                    target = stat.income;
                } else {
                    target = stat.inner_income;
                }

                target[record.op_type] = BigNumberUtil.add(
                    target[record.op_type],
                    record.change_amount,
                );
            }

            this.m_totalIncome[address] = {
                lastUpdateBlock: currentHeight,
                stat: stat
            };

            return stat;

        } catch (error) {
            logger.error('getTotalIncomeByAddress failed.', address, error);

            return null;
        }
    }

    // async getHashSizeList() {
    //     return this.m_hashSizeList;
    // }

    // async _refreshHashSizeList() {
    //     const currentHeight = await this.getLastSyncBlockHeight();

    //     if (currentHeight <= this.m_hashSizeList.lastProcessBlock) {
    //         return;
    //     }

    //     console.log('will refresh hash size list');

    //     try {
    //         const stmt = store.indexDB.prepare(
    //             `SELECT * FROM ${TABLE_NAME.INSCRIBE_DATA} WHERE block_height > ? and block_height <= currentHeight`
    //         );
    //         const list = stmt.all(this.m_lastProcessedBlock, currentHeight);

    //         const maxBlockHeight = 0;
    //         for (const item of list) {
    //             const { method, size, hash } = Util.decode_mixhash(item.hash);
    //             if (size < DATA_HASH_START_SIZE) {
    //                 size = DATA_HASH_START_SIZE;
    //             }
    //             this.m_hashSizeList[hash] = size;
    //         }

    //         this.m_lastProcessedBlock = currentHeight;

    //         console.log('refresh hash size list completely, current height:', currentHeight);

    //     } catch (error) {
    //         console.error('refreshHashSizeList failed:', error);
    //     }
    // }
};

module.exports = {
    StatManager,
    TABLE_NAME,
};