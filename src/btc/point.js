const assert = require('assert');

class OutPoint {
    constructor(txid, vout) {
        /// The referenced transaction's txid.
        this.txid = txid;

        /// The index of the referenced output in its transaction's vout.
        this.vout = vout;
    }

    to_string() {
        return `${this.txid}:${this.vout}`;
    }

    /**
     *
     * @param {string} outpoint_str in format `txid:vout`
     * @returns {ret: number, outpoint: OutPoint}
     */
    static parse(outpoint_str) {
        const arr = outpoint_str.split(':');
        if (arr.length !== 2) {
            console.error(`invalid outpoint ${outpoint_str}`);
            return { ret: -1 };
        }

        return { ret: 0, outpoint: new OutPoint(arr[0], Number(arr[1])) };
    }
}

class SatPoint {
    constructor(outpoint, offset) {
        assert(outpoint instanceof OutPoint, `invalid outpoint`);
        assert(_.isNumber(offset), `invalid offset ${offset}`);
        assert(offset >= 0);

        this.outpoint = outpoint;
        this.offset = offset;
    }

    to_string() {
        return `${this.outpoint.to_string()}:${this.offset}`;
    }

    /**
     *
     * @param {string} satpoint_str in format `txid:vout:offset`
     * @returns {ret: number, satpoint: SatPoint}
     */
    static parse(satpoint_str) {
        assert(_.isString(satpoint_str), `invalid satpoint_str ${satpoint_str}`);
        
        const arr = satpoint_str.split(':');
        if (arr.length !== 3) {
            console.error(`invalid satpoint ${satpoint_str} on parse`);
            return { ret: -1 };
        }

        return {
            ret: 0,
            satpoint: new SatPoint(new OutPoint(arr[0], Number(arr[1])), Number(arr[2])),
        };
    }
}

module.exports = { OutPoint, SatPoint };
