const { store, TABLE_NAME } = require('./store');
const { ERR_CODE, makeResponse, makeSuccessResponse } = require('./util');
const { Util } = require('../../util');
const { DATA_HASH_START_SIZE } = require('../../constants');

/*60s, significantly less than block generation time
should theoretically reflect the latest data promptly.*/
const UPDATE_INTERVAL = 60 * 1000;

class RankStore {
    constructor() {
        this.m_hashSizeList = {};   // { hash: size }

        this.m_resonantRankList = {
            lastUpdateTime: 0,
            list: null
        };
    }

    async queryResonantRank(limit, offset) {
        try {
            const now = Date.now();
            if (now - this.m_resonantRankList.lastUpdateTime > UPDATE_INTERVAL) {
                const list = await this._getResonantRankList();
                //console.debug('resonant rank list:', list);
                if (list) {
                    this.m_resonantRankList.list = list;
                    this.m_resonantRankList.lastUpdateTime = now;
                }
            }

            const list = this.m_resonantRankList.list;
            if (!list) {
                return makeResponse(ERR_CODE.UNKNOWN_ERROR);
            }

            const result = list.slice(offset, offset + limit);

            return makeSuccessResponse({
                count: list.length,
                list: result
            });

        } catch (error) {
            console.error('getResonantRank failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    async _getResonantRankList() {
        try {
            const stmt = store.indexDB.prepare(
                `SELECT * FROM 
                ${TABLE_NAME.INSCRIBE_DATA} 
                WHERE price != '0' AND resonance_count < 15`
            );
            const list = stmt.all();
            //console.debug('resonant data list:', list);

            if (list.length == 0) {
                return list;
            }

            for (const item of list) {
                if (this.m_hashSizeList[item.hash]) {
                    continue;
                }

                let { method, size, hash } = Util.decode_mixhash(item.hash);
                if (size < DATA_HASH_START_SIZE) {
                    size = DATA_HASH_START_SIZE;
                }
                this.m_hashSizeList[item.hash] = size;
            }

            //console.debug('hash size list:', this.m_hashSizeList);

            const pointsStmt = store.ethIndexDb.prepare(
                `SELECT hash, MAX(point) AS max_point
                FROM ${TABLE_NAME.POINTS}
                GROUP BY hash;`
            );
            const pointsList = pointsStmt.all();

            if (pointsList.length == 0) {
                return [];
            }

            //console.debug('point list:', pointsList);

            let pointsMap = {};
            for (const item of pointsList) {
                pointsMap[item.hash] = item.max_point;
            }

            // calc rank = point*size
            for (const item of list) {
                item.point = pointsMap[item.hash] || 1;
                item.size = this.m_hashSizeList[item.hash];
                item.rank = item.point * item.size;
            }

            list.sort((a, b) => {
                return b.rank - a.rank;
            });

            return list;

        } catch (error) {
            console.error('getResonantRank failed:', error);

            return null;
        }
    }
}

module.exports = {
    RankStore
};