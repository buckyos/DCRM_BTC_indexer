const assert = require('assert');
const { BTCClient } = require('./btc');
const { OutPoint } = require('./point');

class UTXOMemoryCache {
    constructor(btc_client) {
        assert(btc_client instanceof BTCClient, `invalid btc_client`);

        this.btc_client = btc_client;

        // outpoint -> { value, address }
        this.utxo = new Map();
    }

    /**
     *
     * @param {string} outpoint in format `txid:vout`
     * @returns {Promise<{ret: number, value: number, address: string}>}
     */
    async get_uxto(outpoint) {
        assert(_.isString(outpoint), `invalid outpoint ${outpoint}`);

        const { value, address } = this.utxo.get(outpoint);
        if (value != null) {
            return { ret: 0, value, address };
        }

        // search
        const { ret, value: search_value, address: search_address } = await this._search_utxo(outpoint);
        if (ret !== 0) {
            console.error(`failed to search utxo ${outpoint}`);
            return { ret };
        }

        return { ret: 0, value: search_value, address: search_address };
    }

    /**
     *
     * @param {string} outpoint_str in format `txid:vout`
     * @returns {Promise<{ret: number, value: number}>}
     */
    async _search_utxo(outpoint_str) {
        assert(_.isString(outpoint_str), `invalid outpoint ${outpoint_str}`);

        // parse txid:offset
        const { ret, outpoint } = OutPoint.parse(outpoint_str);
        assert(ret === 0);

        // get transaction
        const { ret: get_tx_ret, tx } = await this.btc_client.get_transaction(
            outpoint.txid,
        );
        if (get_tx_ret !== 0) {
            console.error(`failed to get transaction ${outpoint.txid}`);
            return { ret: get_tx_ret };
        }

        if (outpoint.vout >= tx.outputs.length) {
            console.error(
                `invalid offset ${outpoint_str} ${tx.outputs.length}`,
            );
            return { ret: -1 };
        }

        const vout = tx.outputs[outpoint.vout];
        const value = vout.value * 100000000;

        let address = null;
        if (vout.scriptPubKey && vout.scriptPubKey.address) {
            address = vout.scriptPubKey.address;
        } else {
            console.warn(`failed to get address for ${outpoint_str}`);
        }

        this.utxo.set(outpoint_str, {
            value,
            address,
        });

        return { ret: 0, value, address };
    }
}

module.exports = { UTXOMemoryCache };
