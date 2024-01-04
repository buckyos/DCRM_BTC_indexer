const assert = require('assert');
const {Util} = require('../util');

class HashCollector {
    constructor() {
        this.hash_set = new Set();
    }

    add(hash) {
        assert(_.isString(hash), `invalid hash ${hash}`);

        this.hash_set.add(hash);
    }

    has(hash) {
        assert(_.isString(hash), `invalid hash ${hash}`);

        return this.hash_set.has(hash);
    }

    select_random_one() {
        const arr = Array.from(this.hash_set);
        const index = Math.floor(Math.random() * arr.length);
        return arr[index];
    }
}

const hash_collector = new HashCollector();

class InscribeDataOpGenerator{
    constructor() {
    }

    // gen hash 32bytes len with random data, in hex code string
    /**
     *
     * @returns {string}
     */
    gen_random_hash() {
        const len = 32;
        const buf = Buffer.alloc(len);
        for (let i = 0; i < len; ++i) {
            buf[i] = Math.floor(Math.random() * 256);
        }

        return buf.toString('hex');
    }

    // (txid - hash) % 32 == 0
    gen_random_hash_with_check_valid(txid) {
        assert(_.isString(txid), `invalid txid ${txid}`);

        
        // eslint-disable-next-line no-constant-condition
        while(true) {
            const hash = this.gen_random_hash()

            if (Util.check_inscribe_hash_and_txid(hash, txid, 32)) {
                return hash;
            }
        }
    }

    gen_content(commit_txid) {
        let ph;
        if (commit_txid == null) {
            ph = this.gen_random_hash();
        } else {
            ph = this.gen_random_hash_with_check_valid(commit_txid);
        }

        hash_collector.add(ph);

        const content = {
            p: 'pdi',
            op: 'inscribe',
            ph,
            text: 'inscribe_data_1',
            amt: '1000',
            price: '100',
        };

        return content;
    }
}

class SetPriceOpGenerator {
    constructor() {
    }

    gen_content(ph) {
        if (ph == null) {
            ph = this.gen_random_hash();
        }

        const content = {
            p: 'pdi',
            op: 'set',
            price: '100',
            ph,
        };

        return content;
    }
}
module.exports = {
    InscribeDataOpGenerator,
};