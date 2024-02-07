const assert = require('assert');
const { ETHIndex } = require('../../eth/index');
const { POINT_CHAIN_ETH } = require('../../constants');

class HashHelper {
    constructor(eth_index) {
        assert(eth_index, `eth_index should not be null`);
        assert(eth_index instanceof ETHIndex, `eth_index should be ETHIndex`);

        this.eth_index = eth_index;
    }
    
    /**
     * @comment calculate the level of the user based on the experience value
     * @param {number} exp 
     * @returns {number}
     */
    _get_level(exp) {
        assert(_.isNumber(exp), `exp should be number: ${exp}`);
        assert(exp >= 0, `exp should be positive: ${exp}`);

        // define the range of experience values for each level
        const levels = [
            [1, 5], [5, 16], [16, 25], [25, 34], [34, 40],
            [40, 65], [65, 95], [95, 155], [155, 275], [275, 515],
            [515, 800], [800, 1500], [1500, 2500], [2500, 4000], [4000, 6000],
            [6000, 10000], [10000, 15000], [15000, 20000], [20000, 30000], [30000, 50000]
        ];
        // traverse the level and the corresponding range of experience values
        for (let level = 1; level <= levels.length; level++) {
            const [min_exp, max_exp] = levels[level - 1];
            if (min_exp <= exp && exp < max_exp) {
                return level;
            }
        }

        // if the experience value exceeds the defined range, return the highest level
        return levels.length;
    }

    /**
     * @comment calculate the weight of the user based on the level  
     * @param {number} level
     * @returns {number}
     */
    _get_weight_on_level(level) {
        assert(_.isNumber(level), `level should be number: ${level}`);
        assert(level >= 0, `level should be positive: ${level}`);

        // define the daily income corresponding to the level
        const income = [
            500, 1000, 1500, 2000, 2500,
            3000, 4000, 5000, 6000, 7000,
            8000, 9000, 10000, 15000, 20000,
            30000, 40000, 50000, 100000, 200000
        ];

        // return daily income based on level
        if (level < 1) {
            return 0;
        }

        if (1 <= level <= 20) {
            return income[level - 1];
        } 

        return 200000;  // if the level is not within the defined range
    }

    /**
     * query hash weight from eth network, maybe wait for a while if block not synced yet
     * @param {number} timestamp
     * @param {string} hash
     * @returns {ret: number, weight: string, point: number}
     */
    async query_hash_weight(timestamp, hash) {
        assert(_.isString(hash), `hash should be string ${hash}`);

        // query hash exp from eth network around timestamp history
        const { ret, exp, point } = await this.eth_index.query_hash_exp(
            timestamp,
            hash,
        );
        if (ret !== 0) {
            console.error(`failed to query hash exp ${exp}`);
            return { ret };
        }

        // calculate point now
        const level = this._get_level(exp);
        const weight = this._get_weight_on_level(level);

        console.log(
            `calc hash weight ${hash} point: ${point} weight: ${weight}`,
        );

        return { 
            ret: 0, 
            weight: weight.toString(), 
            
            chain: POINT_CHAIN_ETH, 
            exp,
            point
         };
    }
}

module.exports = { HashHelper };
