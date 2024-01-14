
const assert = require('assert');
const { BTCClient } = require('../btc/btc');
const { OrdClient } = require('../btc/ord');
const {SatPoint} = require('../btc/point');

class UTXORetriever {
    constructor(config) {
        assert(_.isObject(config), `invalid config: ${config}`);

        this.config = config;
        this.ord_client = OrdClient.new_from_config(config);
        this.btc_client = BTCClient.new_from_config(config);
    }

    /**
     * @command get utxo by inscription id
     * @param {string} inscription_id 
     * @returns {Promise<{ret: number, status: number, info: object}>}
     */
    async get_utxo_by_inscription_id(inscription_id) {
        assert(
            _.isString(inscription_id),
            `invalid inscription_id: ${inscription_id}`,
        );

        {
            await this.ord_client.get_inscription_batch([inscription_id]);
        }
        const { ret, inscription } = await this.ord_client.get_inscription(
            inscription_id,
        );
        if (ret !== 0) {
            console.error(`failed to get inscription ${inscription_id}`);
            return { ret };
        }

        if (inscription == null) {
            console.warn(`inscription ${inscription_id} not found`);
            return { ret: 0, status: 404 };
        }

        assert(inscription.satpoint != null, `invalid inscription: ${inscription}`);

        const {ret: parse_ret, satpoint} = SatPoint.parse(inscription.satpoint);
        if (parse_ret !== 0) {
            console.error(`failed to parse satpoint ${inscription.satpoint}`);
            return { ret: parse_ret };
        }

        // get tx from btc
        const { ret: ret_tx, tx } = await this.btc_client.get_transaction(
            satpoint.txid,
        );
        if (ret_tx !== 0) {
            console.error(`failed to get transaction ${satpoint.txid}`);
            return { ret: ret_tx };
        }

        if (tx == null) {
            console.warn(`transaction ${satpoint.txid} not found`);
            return { ret: 0, status: 404 };
        }

        // get output within the tx
        if (satpoint.vout >= tx.vout.length) {
            console.warn(
                `invalid vout ${satpoint.vout} for tx ${satpoint.txid}`,
            );
            return { ret: 0, status: 404 };
        }

        const info = {
            txid: satpoint.txid,
            vout: satpoint.vout,
            offset: satpoint.offset,
            output: tx.vout[satpoint.vout],
        };

        return { ret: 0, status: 200, info };
    }
}

module.exports = {
    UTXORetriever,
};