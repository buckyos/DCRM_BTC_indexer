const assert = require('assert');
const { ETHIndex } = require('../../eth/index');
const { Util } = require('../../util');

class HashHelper {
    constructor(eth_index) {
        assert(eth_index, `eth_index should not be null`);
        assert(eth_index instanceof ETHIndex, `eth_index should be ETHIndex`);

        this.eth_index = eth_index;
    }
    /**
     * query hash weight from eth network, maybe wait for a while if block not synced yet
     * @param {number} timestamp
     * @param {string} hash
     * @returns {ret: number, weight: string, point: number}
     */
    async query_hash_weight(timestamp, hash) {
        assert(_.isString(hash), `hash should be string`);

        // first decode mixhash string
        let data_size;
        try {
            const ret = Util.decode_mixhash(hash);
            data_size = ret.size;
        } catch (error) {
            console.error(`failed to decode hash ${hash}: ${error}`);
            return { ret: -1 };
        }

        // query hash point from eth network around timestamp history
        const { ret, point } = await this.eth_index.query_hash_point(
            timestamp,
            hash,
        );
        if (ret !== 0) {
            console.error(`failed to query hash point ${hash}`);
            return { ret };
        }

        // calculate price now
        assert(point > 0);
        const weight = Util.calc_point(data_size, point);
        console.log(
            `calc hash weight ${hash} point: ${point} weight: ${weight}`,
        );

        return { ret: 0, weight, point };
    }
}

module.exports = { HashHelper };
