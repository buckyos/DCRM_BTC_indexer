const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');
const bs58 = require('bs58');
const sb = require('satoshi-bitcoin');
const Decimal = require('decimal.js');

class Util {
    /**
     * @comment return satpoint all of zero
     * @returns {string}
     */
    static zero_satpoint() {
        return `0000000000000000000000000000000000000000000000000000000000000000:0:0`;
    }

    /**
     *
     * @param {string} satpoint
     * @returns {boolean}
     */
    static is_zero_satpoint(satpoint) {
        assert(_.isString(satpoint), `satpoint should be string ${satpoint}`);

        return satpoint === this.zero_satpoint();
    }

    /**
     * @comment return btc address all of zero
     * @returns {string}
     */
    static zero_btc_address() {
        return '1111111111111111111114oLvT2';
    }

    /**
     * @comment convert satoshi to btc
     * @param {number | string} btc
     * @returns {number}
     */
    static btc_to_satoshi(btc) {
        // return Math.round(btc * 100000000);

        return sb.toSatoshi(btc);
    }

    // the last 8 bytes of the address sum to 0x00
    static address_number(address) {
        assert(_.isString(address), `address should be string ${address}`);
        assert(address.length >= 8, `address length should >= 8 ${address}`);

        let sum = 0;
        for (let i = 0; i < 8; i++) {
            sum += address.charCodeAt(address.length - 1 - i);
        }

        return sum;
    }

    static get_data_dir(config) {
        let dir = config.db.data_dir
            ? config.db.data_dir
            : path.join(os.homedir(), 'dcrm', 'data');

        if (config.isolate) {
            dir = path.join(dir, config.isolate);
        }

        if (!fs.existsSync(dir)) {
            try {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`create data dir ${dir}`);
            } catch (error) {
                console.error(`failed to create data dir ${dir}`, error);
                return { ret: -1, dir: null };
            }
        }

        return { ret: 0, dir };
    }

    /**
     *
     * @param {string} id
     * @returns {ret: number, txid: string, index: number}
     */
    static parse_inscription_id(id) {
        const TXID_LEN = 64;
        const MIN_LEN = TXID_LEN + 2;

        if (id.length < MIN_LEN) {
            console.error(`id Length error: ${id} ${id.length}`);
            return {
                ret: -1,
            };
        }

        const txid = id.slice(0, TXID_LEN);
        const separator = id.charAt(TXID_LEN);

        if (separator !== 'i') {
            console.error(`Separator error: ${id}, ${separator}`);
            return {
                ret: -1,
            };
        }

        const index = id.slice(TXID_LEN + 1);

        // Ensure index is a valid integer
        if (!Number.isInteger(Number(index))) {
            console.error(`Index error: ${id}, ${index}`);
            return {
                ret: -1,
            };
        }

        return {
            ret: 0,
            txid: txid,
            index: Number(index),
        };
    }

    /**
     *
     * @param {string} sat_point_str
     * @returns {ret: number, outpoint: string, offset: number}
     */
    static parse_sat_point(sat_point_str) {
        assert(
            _.isString(sat_point_str),
            `satpoint should be string ${sat_point_str}`,
        );

        const last_colon_index = sat_point_str.lastIndexOf(':');
        if (last_colon_index === -1) {
            console.error(`Invalid SatPoint string ${sat_point_str}`);
            return {
                ret: -1,
            };
        }

        const out_point = sat_point_str.slice(0, last_colon_index);
        const off_set = parseInt(sat_point_str.slice(last_colon_index + 1), 10);
        if (isNaN(off_set)) {
            console.error(`Invalid SatPoint string ${sat_point_str}`);
            return {
                ret: -1,
            };
        }

        return {
            ret: 0,
            outpoint: out_point,
            offset: off_set,
        };
    }

    /**
     * try convert hash string in hex to base58 string
     * @param {string} hash_str
     * @returns {ret: number, hash_str: string}
     */
    static hex_to_base58(hash_str) {
        // Try to decode as hex
        try {
            if (hash_str.startsWith('0x') || hash_str.startsWith('0X')) {
                hash_str = hash_str.slice(2);
            }

            const ret = new Uint8Array(Buffer.from(hash_str, 'hex'));
            hash_str = bs58.encode(ret);

            return { ret: 0, hash_str };
        } catch (err) {
            console.warn(`hash not a hex string ${hash_str} ${err}`);
        }

        return { ret: -1 };
    }

    /**
     * try to parse hash string as base58 or hex
     * @param {string} str
     * @returns {Uint8Array}
     */
    static parse_hash_str(hash_str) {
        // Try to decode as base58
        try {
            return bs58.decode(hash_str);
        } catch (err) {
            console.warn(
                `hash str not a base58 string, now try hex ${hash_str} ${err}`,
            );
        }

        // Try to decode as hex
        try {
            if (hash_str.startsWith('0x') || hash_str.startsWith('0X')) {
                hash_str = hash_str.slice(2);
            }

            return new Uint8Array(Buffer.from(hash_str, 'hex'));
        } catch (err) {
            console.warn(`hash not a hex string ${hash_str} ${err}`);
        }

        throw new Error(
            `Hash is neither a hex string nor a base58 string ${hash_str}`,
        );
    }

    /**
     * 
     * @param {string} mixhash 
     * @returns {boolean}
     */
    static is_valid_mixhash(mixhash) {
        assert(_.isString(mixhash), `mixhash should be string ${mixhash}`);

        try {
            const decoded = this.parse_hash_str(mixhash);
            if (decoded.length !== 32) {
                return false;
            }

        } catch (error) {
            return false;
        }
        
        return true;
    }
    /**
     *
     * @param {string} mixhash
     * @returns {method: number, size: number, hash: string}
     */
    static decode_mixhash(mixhash) {
        assert(_.isString(mixhash), `mixhash should be string ${mixhash}`);

        const decoded = this.parse_hash_str(mixhash);
        if (decoded.length !== 32) {
            throw new Error(
                `Hash length is not 32 bytes long ${mixhash} ${decoded.length}`,
            );
        }

        // Create a DataView for the decoded hash
        const dataView = new DataView(decoded.buffer);

        // Parse the hash algorithm selection (2 bits)
        const method = dataView.getUint8(0) >> 6;

        // Parse the file size (62 bits)
        // Note: JavaScript can only precisely represent integers up to 53 bits
        // If the file size can be larger than that, we should use a library for big integers
        const size =
            ((dataView.getUint8(0) & 0x3f) << 56) |
            (dataView.getUint8(1) << 48) |
            (dataView.getUint8(2) << 40) |
            (dataView.getUint8(3) << 32) |
            (dataView.getUint8(4) << 24) |
            (dataView.getUint8(5) << 16) |
            (dataView.getUint8(6) << 8) |
            dataView.getUint8(7);

        // Parse the root node hash (192 bits)
        const hash = new Uint8Array(decoded.buffer, 8, 24);

        return { method, size, hash };
    }

    /**
     * @comment sleep for milliseconds
     * @param {number} ms
     */
    static async sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /*
    static calc_point(data_size, point) {
        const baseScore =
            999 /
                (1 + Math.exp(-0.00000762939453125 * (data_size - 127999999))) +
            1;
        const baseRate = 19 / (1 + Math.exp(-0.15 * (point - 90))) + 1;
        const score = baseScore * baseRate * 2;
        return score;
    }
    */

    /**
     *
     * @param {string | number} data_size
     * @param {string | number} point
     * @returns {string}
     */
    static calc_point(data_size, point) {
        const baseScore = new Decimal(999)
            .dividedBy(
                Decimal.one.plus(
                    Decimal.exp(
                        new Decimal('-0.00000762939453125').times(
                            new Decimal(data_size).minus(
                                new Decimal('127999999'),
                            ),
                        ),
                    ),
                ),
            )
            .plus(1);

        const baseRate = new Decimal(19)
            .dividedBy(
                Decimal.one.plus(
                    Decimal.exp(
                        new Decimal(-0.15).times(new Decimal(point).minus(90)),
                    ),
                ),
            )
            .plus(1);

        const score = baseScore.times(baseRate).times(2);
        return score.toString();
    }

    /**
     *
     * @param {string} hash in base58
     * @param {string} txid in hex
     * @returns {boolean}
     */
    static check_inscribe_hash_and_txid(hash, txid, hash_threshold) {
        assert(_.isString(hash), `hash should be string ${hash}`);
        assert(_.isString(txid), `txid should be string ${txid}`);
        assert(hash_threshold > 0, `hash_threshold should be greater than 0 ${hash_threshold}`);

        const hash_number = this.address_number(hash);
        const txid_number = this.address_number(txid);
        const ret = Math.abs(hash_number - txid_number) % hash_threshold;
        
        return ret === 0;
    }

    /**
     *
     * @param {string} hash base58
     * @param {string} address base58
     * @returns {number}
     */
    static calc_distance_with_hash_and_address(hash, address) {
        assert(_.isString(hash), `hash should be string ${hash}`);
        assert(_.isString(address), `address should be string ${address}`);

        const hash_number = this.address_number(hash);
        const address_number = this.address_number(address);
        const distance = Math.abs(hash_number - address_number);
        return distance;
    }
}

const BigNumber = require('bignumber.js');
const { TOKEN_DECIMAL } = require('./constants');

class BigNumberUtil {
    constructor() {
        console.log(`BigNumberUtil global init`);
        BigNumber.config({ DECIMAL_PLACES: TOKEN_DECIMAL });
    }

    /**
     *
     * @param {string | number} a
     * @param {string | number} b
     * @returns {string}
     */
    static add(a, b) {
        return new BigNumber(a).plus(new BigNumber(b)).toString();
    }

    /**
     *
     * @param {string | number} a
     * @param {string | number} b
     * @returns {string}
     */
    static subtract(a, b) {
        return new BigNumber(a).minus(new BigNumber(b)).toString();
    }

    /**
     *
     * @param {string | number} a
     * @param {string | number} b
     * @returns {string}
     */
    static multiply(a, b) {
        return new BigNumber(a).times(new BigNumber(b)).toString();
    }

    /**
    * 
    * @param {string | number} a 
    * @param {string | number} b 
    * @returns {string}
    */
    static divide(a, b) {
        return new BigNumber(a).dividedBy(new BigNumber(b)).toString();
    }

    /**
    * 
    * @param {string | number} a 
    * @param {string | number} b 
    * @returns {number}
    */
    static compare(a, b) {
        return new BigNumber(a).comparedTo(new BigNumber(b));
    }

    /**
     * @comment check if the string is decimal and precision is less than 18
     * @param {string} str
     * @returns {boolean}
     */
    static check_decimal_string(str) {
        const regex = /^-?\d+(\.\d{1,18})?$/;
        return regex.test(str);
    }

    // check if the string is >=0 number string
    static is_positive_number_string(str) {
        if (str == null || !_.isString(str)) {
            return false;
        }

        // must be valid decimal string
        if (!BigNumberUtil.check_decimal_string(str)) {
            return false;
        }

        if (BigNumberUtil.compare(str, '0') < 0) {
            return false;
        }

        return true;
    }

    // check if the string valid number string
    static is_number_string(str) {
        if (str == null || !_.isString(str)) {
            return false;
        }

        // must be valid decimal string
        if (!BigNumberUtil.check_decimal_string(str)) {
            return false;
        }

        return true;
    }
}

new BigNumberUtil();

module.exports = { Util, BigNumberUtil };

/*
function test() {
    const v = '100';
    assert(BigNumberUtil.check_decimal_string(v));

    const v1 = '100.000';
    assert(BigNumberUtil.check_decimal_string(v1));

    const v2 = '100.000000000000000001';
    assert(BigNumberUtil.check_decimal_string(v2));

    const v3 = '100.0000000000000000001';
    assert(!BigNumberUtil.check_decimal_string(v3));

    const v4 = '100av';
    assert(!BigNumberUtil.check_decimal_string(v4));
}
*/

// test();
