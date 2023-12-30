const assert = require('assert');
const { InscriptionTransferStorage } = require('../storage/transfer');
const { Util } = require('../util');
const { BTCClient } = require('../btc/btc');
const { TxSimpleItem } = require('../btc/tx');
const { OutPoint, SatPoint } = require('../btc/point');
const { UTXOMemoryCache } = require('../btc/utxo');
const { OrdClient } = require('../btc/ord');

// inscription transfer record item
class InscriptionTransferRecordItem {
    constructor(inscription_id, block_height, timestamp, satpoint, address) {
        assert(_.isString(inscription_id), `invalid inscription_id`);
        assert(_.isNumber(block_height), `invalid block_height`);
        assert(_.isNumber(timestamp), `invalid timestamp`);
        assert(_.isString(satpoint), `invalid satpoint`);
        assert(_.isString(address), `invalid address`);

        this.inscription_id = inscription_id;
        this.block_height = block_height;
        this.timestamp = timestamp;
        this.satpoint = satpoint;
        this.address = address;
    }

    static from_db_record(record) {
        assert(record != null, `record should not be null`);

        return new InscriptionTransferRecordItem(
            record.inscription_id,
            record.block_height,
            record.timestamp,
            record.satpoint,
            record.address,
        );
    }

    is_equal(other) {
        assert(other instanceof InscriptionTransferRecordItem, `invalid other`);

        return (
            this.inscription_id === other.inscription_id &&
            this.block_height === other.block_height &&
            this.timestamp === other.timestamp &&
            this.satpoint === other.satpoint &&
            this.address === other.address
        );
    }
}

class InscriptionTransferMonitor {
    constructor(config) {
        assert(config != null, `config should not be null`);

        this.config = config;
        this.inscriptions = new Map();

        const { ret, dir } = Util.get_data_dir(config);
        if (ret !== 0) {
            throw new Error(`failed to get data dir`);
        }

        this.storage = new InscriptionTransferStorage(dir);

        this.btc_client = new BTCClient(
            config.btc.host,
            config.btc.network,
            config.btc.auth,
        );
        this.utxo_cache = new UTXOMemoryCache(this.btc_client);
    }

    /**
     * init inscription transfer monitor at start
     * @returns {Promise<{ret: number}>}
     */
    async init() {
        const { ret } = await this.storage.init();
        if (ret !== 0) {
            console.error(`failed to init inscription transfer storage`);
            return { ret };
        }

        const { ret: load_ret } = await this.load_all();
        if (load_ret !== 0) {
            console.error(`failed to load all inscriptions`);
            return { ret: load_ret };
        }

        console.info(`init inscription transfer monitor success`);
        return { ret: 0 };
    }

    async load_all() {
        const { ret, data } = await this.storage.get_all_inscriptions_with_last_transfer();
        if (ret !== 0) {
            console.error(`failed to get all transfer`);
            return { ret };
        }

        if (data == null || data.length === 0) {
            console.info(`no inscription transfer loaded`);
            return { ret: 0 };
        }

        for (let i = 0; i < data.length; ++i) {
            const record = data[i];
            const item = InscriptionTransferRecordItem.from_db_record(record);

            const { ret, satpoint } = SatPoint.parse(item.satpoint);
            assert(ret === 0, `invalid satpoint ${item.satpoint}`);
            assert(satpoint != null, `invalid satpoint ${item.satpoint}`);

            // index by outpoint
            const outpoint_str = satpoint.outpoint.to_string();
            assert(
                this.inscriptions.get(outpoint_str) == null,
                `outpoint ${outpoint_str} already exists`,
            );
            this.inscriptions.set(outpoint_str, item);
        }

        console.log(`loaded all inscriptions: ${this.inscriptions.size}`);
        return { ret: 0 };
    }

    
    /**
     * add new inscription on inscription index scanner, then we can monitor it
     * it's the firt step to monitor a new inscription, and it's the first transfer record
     * @param {string} inscription_id 
     * @param {number} block_height 
     * @param {number} timestamp 
     * @param {string} creator_address 
     * @param {SatPoint} satpoint 
     * @returns {Promise<{ret: number}>}
     */
    async add_new_inscription(
        inscription_id,
        block_height,
        timestamp,
        creator_address,
        satpoint,
        value,
    ) {
        assert(_.isString(inscription_id), `invalid inscription_id`);
        assert(_.isNumber(block_height), `invalid block_height`);
        assert(_.isNumber(timestamp), `invalid timestamp`);
        assert(_.isString(creator_address), `invalid creator address`);
        assert(satpoint instanceof SatPoint, `invalid satpoint`);
        assert(_.isNumber(value), `invalid value`);

        const { ret } = await this._on_inscription_transfer(
            inscription_id,
            block_height,
            timestamp,
            satpoint,
            creator_address,
            value,
        );
        if (ret !== 0) {
            console.error(
                `failed to add new inscription ${inscription_id}, block ${block_height}, ${satpoint}, ${creator_address}`,
            );
            return { ret };
        }

        return { ret: 0 };
    }

    /**
     * The inscription content is contained within the input of a reveal transaction, and the inscription is made on the first sat of its input. This sat can then be tracked using the familiar rules of ordinal theory, allowing it to be transferred, bought, sold, lost to fees, and recovered.
     * @param {string} inscription_id
     * @returns {Promise<{ret: number, satpoint: SatPoint, address: string, value: number}>}
     */
    async calc_create_satpoint(inscription_id) {
        const {
            ret: parse_ret,
            txid,
            index,
        } = Util.parse_inscription_id(inscription_id);
        assert(
            parse_ret === 0,
            `failed to parse inscription id: ${inscription_id}`,
        );

        const { ret: tx_ret, tx } = await this.btc_client.get_transaction(txid);
        if (tx_ret !== 0) {
            console.error(`failed to get transaction ${txid}`);
            return { ret: tx_ret };
        }

        // FIXME there maybe more than one inscription in one tx's input
        if (index >= tx.vin.length) {
            console.error(`invalid index ${index} >= ${tx.vin.length} in tx ${txid} ${inscription_id}`);
            index = tx.vin.length - 1;
        }

        assert(
            index < tx.vin.length,
            `invalid index ${inscription_id} ${index} >= ${tx.vin.length}`,
        );
        const vin = tx.vin[index];
        const satpoint = new SatPoint(new OutPoint(vin.txid, vin.vout), 0);

        const tx_item = new TxSimpleItem(tx);
        const {
            ret: calc_ret,
            point,
            address,
            value,
        } = await tx_item.calc_next_satpoint(satpoint, this.utxo_cache);
        if (calc_ret !== 0) {
            console.error(
                `failed to calc creator satpoint ${satpoint.to_string()}`,
            );
            return { ret: calc_ret };
        }

        console.log(
            `found creator satpoint ${inscription_id} ${point.to_string()}, address: ${address}`,
        );

        return { ret: 0, satpoint: point, address, value };
    }

    async process_block(block_height) {
        const { ret, block } = await this.btc_client.get_block(block_height);
        if (ret !== 0) {
            console.error(`failed to get block ${block_height}`);
            return { ret };
        }

        const txs = block.tx;
        for (let i = 0; i < txs.length; ++i) {
            const txid = txs[i];
            const { ret, tx } = await this.btc_client.get_transaction(txid);
            if (ret !== 0) {
                console.error(`failed to get transaction ${txid}`);
                return { ret };
            }

            const tx_item = new TxSimpleItem(tx);

            // check all input in current tx if match any inscription outpoint
            for (let j = 0; j < tx_item.vin.length; ++j) {
                const outpoint_str = tx_item.vin[j];

                const inscription = this.inscriptions.get(outpoint_str);
                if (inscription == null) {
                    continue;
                }

                console.log(
                    `found inscription ${inscription.inscription_id} transfer at block ${block_height} ${outpoint_str}`,
                );

                const { ret: parse_ret, satpoint } = SatPoint.parse(inscription.satpoint);
                assert(parse_ret === 0, `invalid satpoint ${inscription.satpoint}`);

                // calc next satpoint
                const { ret, point, address, value } =
                    await tx_item.calc_next_satpoint(
                        satpoint,
                        this.utxo_cache,
                    );
                if (ret !== 0) {
                    console.error(
                        `failed to calc inscription next satpoint ${
                            inscription.inscription_id
                        } ${inscription.satpoint}`,
                    );
                    return { ret };
                }

                if (point != null) {
                    console.log(
                        `found inscription transfer ${
                            inscription.inscription_id
                        } ${inscription.satpoint} -> ${point.to_string()}`,
                    );

                    const { ret } = await this._on_inscription_transfer(
                        inscription.inscription_id,
                        block_height,
                        block.time,
                        point,
                        address,
                        value,
                    );
                    if (ret !== 0) {
                        console.error(
                            `failed to process inscription transfer ${
                                inscription.inscription_id
                            } block ${block_height} ${point.to_string()} ${address}`,
                        );
                        return { ret };
                    }
                } else {
                    // inscription is lost?
                    console.warn(
                        `inscription ${inscription.inscription_id} is lost on tx ${txid}`,
                    );
                }
            }
        }

        return { ret: 0 };
    }

    async _on_inscription_transfer(
        inscription_id,
        block_height,
        timestamp,
        satpoint,
        address,
        value,
    ) {
        assert(_.isString(inscription_id), `invalid inscription_id`);
        assert(
            _.isNumber(block_height),
            `invalid block_height ${block_height}`,
        );
        assert(_.isNumber(timestamp), `invalid timestamp ${timestamp}`);
        assert(satpoint instanceof SatPoint, `invalid satpoint`);
        assert(_.isString(address), `invalid address ${address}`);
        assert(_.isNumber(value), `invalid value ${value}`);

        // update db
        const { ret } = await this.storage.insert_transfer(
            inscription_id,
            block_height,
            timestamp,
            satpoint.to_string(),
            address,
            value,
        );
        if (ret !== 0) {
            console.error(
                `failed to add inscription transfer ${inscription_id} block ${block_height} ${satpoint.to_string()} ${address}`,
            );
            return { ret };
        }

        // update cache
        const new_item = new InscriptionTransferRecordItem(
            inscription_id,
            block_height,
            timestamp,
            satpoint.to_string(),
            address,
        );

        const outpoint_str = satpoint.outpoint.to_string();

        const current_item = this.inscriptions.get(outpoint_str);
        if (current_item != null) {
            assert(
                current_item.is_equal(new_item),
                `invalid inscription transfer ${JSON.stringify(current_item)} ${JSON.stringify(new_item)}`,
            );
            return { ret: 0 };
        }

        this.inscriptions.set(outpoint_str, new_item);

        return { ret: 0 };
    }
}

module.exports = { InscriptionTransferMonitor };
