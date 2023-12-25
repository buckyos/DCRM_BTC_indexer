const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(os.homedir(), '.myapp');
const dbFilePath = path.join(dbDir, 'mydatabase.sqlite');

class Util {
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
}

module.exports = { Util };
