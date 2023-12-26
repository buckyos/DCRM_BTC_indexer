const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');
const bs58 = require('bs58');


class Util {
    // the last 5 bytes of the address sum to 0x00
    static address_number(address) {
        let sum = 0;
        for (let i = 0; i < 5; i++) {
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
     * 
     * @param {string} mixhash 
     * @returns {method: number, size: number, hash: string}
     */
    static parse_mixhash(mixhash) {
        assert(_.isString(mixhash), `mixhash should be string ${mixhash}`);

        // 将 base58 编码的字符串解码为 Buffer
        const decoded = bs58.decode(mixhash);
    
        // 获取前两位作为 method
        const method = decoded.slice(0, 1).readUIntBE(0, 1) >> 6;
    
        // 获取接下来的 62 位作为 size
        const size = (decoded.slice(0, 8).readUIntBE(0, 8) << 2) >> 2;
    
        // 获取剩余的 192 位作为 hash
        const hash = decoded.slice(8).toString('hex');
    
        return { method, size, hash };
    }
}

module.exports = { Util };
