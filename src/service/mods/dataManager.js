const { BTCClient } = require('../../btc/btc');
const { store, TABLE_NAME } = require('../biz/store');
const { Util } = require('../../util');
const { DATA_HASH_START_SIZE } = require('../../constants');

const REFRESH_INTERVAL = 60 * 1000; //1分钟刷新一次，远小于出块时间，应该不会有问题

class DataManager {
    constructor() {
        this.m_lastProcessedBlock = 0;
        this.m_hashSizeList = {};
    }

    init() {
        setInterval(async () => {
            await this.refreshHashSizeList();
        }, REFRESH_INTERVAL);
    }

    async getHashSizeList() {
        return this.m_hashSizeList;
    }

    async refreshHashSizeList() {
        const currentHeight = await this.getLastSyncBlockHeight();
        console.log('currentHeight:', currentHeight, 'lastProcessedBlock:', this.m_lastProcessedBlock);

        if (currentHeight <= this.m_lastProcessedBlock) {
            return;
        }

        console.log('will refresh hash size list');

        try {
            const stmt = store.indexDB.prepare(
                `SELECT * FROM ${TABLE_NAME.INSCRIBE_DATA} WHERE block_height > ? and block_height <= currentHeight`
            );
            const list = stmt.all(this.m_lastProcessedBlock, currentHeight);

            const maxBlockHeight = 0;
            for (const item of list) {
                const { method, size, hash } = Util.decode_mixhash(item.hash);
                if (size < DATA_HASH_START_SIZE) {
                    size = DATA_HASH_START_SIZE;
                }
                this.m_hashSizeList[hash] = size;
            }

            this.m_lastProcessedBlock = currentHeight;

            console.log('refresh hash size list completely, current height:', currentHeight);

        } catch (error) {
            console.error('refreshHashSizeList failed:', error);
        }
    }

    async getLastSyncBlockHeight() {
        try {
            const btcStmt = store.indexStateDB.prepare(
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
}