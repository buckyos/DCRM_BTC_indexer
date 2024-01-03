const assert = require('assert');
const { SatPoint, OutPoint } = require('./point');
const { Util } = require('../util');

class TxSimpleItem {
    constructor(tx) {
        this.txid = tx.txid;

        this.vin = [];
        this.vout = [];

        for (let i = 0; i < tx.vin.length; ++i) {
            const vin = tx.vin[i];
            if (vin.coinbase != null) {
                // ignore coinbase tx
                continue;
            }

            const outpoint = `${vin.txid}:${vin.vout}`;

            this.vin.push(outpoint);
        }

        for (let i = 0; i < tx.vout.length; i++) {
            const vout = tx.vout[i];
            const outpoint = `${tx.txid}:${i}`;

            let address = null;
            if (vout.scriptPubKey && vout.scriptPubKey.address) {
                address = vout.scriptPubKey.address;
            } else if (vout.type == 'nulldata') {
                // OP_RETURN, ignore
            } else {
                // FIXME should make sure it is OP_RETURN or known invalid case
                // console.warn(`failed to get address for ${this.txid}:${i}`);
            }

            const item = {
                outpoint,
                value: Util.btc_to_satoshi(vout.value),
                address,
            };

            this.vout.push(item);
        }
    }

    /**
     *
     * @param {SatPoint} satpoint
     * @param {UTXOMemoryCache} utxo_cache
     * @returns {Promise<{ret: number, point: SatPoint, address: string, value: number}>}
     * point is SatPoint, is null if not found
     */
    async calc_next_satpoint(satpoint, utxo_cache) {
        assert(
            satpoint instanceof SatPoint,
            `invalid satpoint on calc_next_satpoint`,
        );

        const index = this.vin.indexOf(satpoint.outpoint.to_string());
        if (index < 0) {
            // any of the monitored outpoint is spent
            return { ret: 0 };
        }

        // calc the sat position in this tx inputs
        let pos = 0;
        for (let i = 0; i < index; ++i) {
            const { ret, value } = await utxo_cache.get_utxo(this.vin[i]);
            if (ret !== 0) {
                console.error(`failed to get utxo ${this.vin[i]}`);
                return { ret };
            }

            pos += value;
        }

        pos += satpoint.offset;

        // find pos in outputs
        let current = 0;
        for (let i = 0; i < this.vout.length; ++i) {
            const output = this.vout[i];
            if (pos >= current && pos < current + output.value) {
                const point = new SatPoint(
                    new OutPoint(this.txid, i),
                    pos - current,
                );

                console.log(
                    `found ordinal ${satpoint.to_string()} -> ${point.to_string()}, address: ${
                        output.address
                    }`,
                );
                return {
                    ret: 0,
                    point,
                    address: output.address,
                    value: output.value,
                };
            }

            current += output.value;
        }

        console.warn(
            `failed to find ordinal ${satpoint.to_string()} in ${
                this.txid
            } ${JSON.stringify(this.vout)}`,
        );

        return { ret: 0 };
    }
}

module.exports = { TxSimpleItem };
