const assert = require('assert');
const { InscriptionTransferStorage } = require('../storage/transfer');
const { Util } = require('../util');
const { BTCClient } = require('../btc/btc');
const { TxSimpleItem } = require('../btc/tx');
const { OutPoint, SatPoint } = require('../btc/point');
const { UTXOMemoryCache } = require('../btc/utxo');
const {
    InscriptionTransferItem,
    InscriptionContentLoader,
    InscriptionOp,
} = require('./item');
const { InscriptionsStorage } = require('../storage/inscriptions');

// inscription transfer record item
class InscriptionTransferRecordItem {
    constructor(
        inscription_id,
        inscription_number,
        block_height,
        timestamp,
        satpoint,
        from_address,
        to_address,
        index, // index Indicates the number of transfers
        op,
    ) {
        assert(_.isString(inscription_id), `invalid inscription_id`);
        assert(_.isNumber(inscription_number), `invalid inscription_number`);
        assert(_.isNumber(block_height), `invalid block_height`);
        assert(_.isNumber(timestamp), `invalid timestamp`);
        assert(
            _.isString(satpoint),
            `invalid satpoint on InscriptionTransferRecordItem constructor`,
        );
        assert(
            from_address == null || _.isString(from_address),
            `invalid from_address`,
        );
        assert(_.isString(to_address), `invalid to_address`);
        assert(_.isNumber(index), `invalid index ${index}`);
        assert(InscriptionOp.contains(op), `invalid op ${op}`);

        this.inscription_id = inscription_id;
        this.inscription_number = inscription_number;
        this.block_height = block_height;
        this.timestamp = timestamp;
        this.satpoint = satpoint;
        this.from_address = from_address;
        this.to_address = to_address;
        this.index = index;
        this.op = op;
    }

    static from_db_record(record) {
        assert(record != null, `record should not be null`);

        return new InscriptionTransferRecordItem(
            record.inscription_id,
            record.inscription_number,
            record.block_height,
            record.timestamp,
            record.satpoint,
            record.from_address,
            record.to_address,
            record.idx,
            record.op,
        );
    }

    is_equal(other) {
        assert(other instanceof InscriptionTransferRecordItem, `invalid other`);

        return (
            this.inscription_id === other.inscription_id &&
            this.inscription_number === other.inscription_number &&
            this.block_height === other.block_height &&
            this.timestamp === other.timestamp &&
            this.satpoint === other.satpoint &&
            this.from_address == other.from_address &&
            this.to_address === other.to_address &&
            this.index === other.index
        );
    }
}

// one outpoint may have more than one inscription transfer record
// then we should had a multi map to store them
class MultiMap {
    constructor() {
        this.map = new Map();
    }

    /**
     *
     * @param {string} key
     * @param {object} value
     */
    set(key, value) {
        if (!this.map.has(key)) {
            this.map.set(key, value);
        } else {
            const currentValue = this.map.get(key);
            if (Array.isArray(currentValue)) {
                if (currentValue.indexOf(value) !== -1) {
                    currentValue.push(value);
                }
            } else {
                if (currentValue !== value) {
                    this.map.set(key, [currentValue, value]);
                }
            }
        }
    }

    // return array or single value, should check by caller
    /**
     *
     * @param {string} key
     * @returns {object|Array<object>}
     */
    get(key) {
        return this.map.get(key);
    }

    /**
     *
     * @param {string} key
     * @returns {Array<object>}
     */
    get_and_remove_array(key) {
        const value = this.map.get(key);
        if (value == null) {
            return null;
        }

        this.map.delete(key);
        if (Array.isArray(value)) {
            return value;
        } else {
            return [value];
        }
    }

    /**
     *
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        return this.map.has(key);
    }

    /**
     *
     * @param {string} key
     * @param {object} value
     * @returns {boolean}
     */
    delete(key, value) {
        const stored_value = this.map.get(key);
        if (stored_value == null) {
            return false;
        }

        if (Array.isArray(stored_value)) {
            const index = stored_value.indexOf(value);
            if (index !== -1) {
                stored_value.splice(index, 1);
                if (stored_value.length === 0) {
                    this.map.delete(key);
                }
                return true;
            }
        } else if (stored_value === value) {
            this.map.delete(key);
            return true;
        } else {
            console.error(
                `invalid stored value ${JSON.stringify(
                    stored_value,
                )} for key ${key}`,
            );
        }

        return false;
    }
}

class InscriptionTransferMonitor {
    constructor(config, transfer_storage) {
        assert(config != null, `config should not be null`);
        assert(
            transfer_storage instanceof InscriptionTransferStorage,
            `invalid transfer_storage`,
        );

        this.config = config;
        this.inscriptions = new MultiMap();

        this.storage = transfer_storage;

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
        const { ret: load_ret } = await this.load_all();
        if (load_ret !== 0) {
            console.error(`failed to load all inscriptions`);
            return { ret: load_ret };
        }

        console.info(`init inscription transfer monitor success`);
        return { ret: 0 };
    }

    async load_all() {
        const { ret, data } =
            await this.storage.get_all_inscriptions_with_last_transfer();
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

            // ignore invalid satpoint
            if (item.satpoint === Util.zero_satpoint()) {
                continue;
            }

            const { ret, satpoint } = SatPoint.parse(item.satpoint);
            assert(
                ret === 0,
                `invalid satpoint ${item.satpoint} on monitor.load_all`,
            );
            assert(
                satpoint != null,
                `invalid satpoint ${item.satpoint} on monitor.load_all`,
            );

            // index by outpoint
            const outpoint_str = satpoint.outpoint.to_string();

            // one outpoint may have more than one inscription transfer record
            this.inscriptions.set(outpoint_str, item);
        }

        // FIXME the size is not correct on multi map
        console.log(`loaded all inscriptions: ${this.inscriptions.size}`);
        return { ret: 0 };
    }

    /**
     * add new inscription on inscription index scanner, then we can monitor it
     * it's the first step to monitor a new inscription, and it's the first transfer record
     * @param {string} inscription_id
     * @param {number} inscription_number
     * @param {number} block_height
     * @param {number} timestamp
     * @param {string} creator_address
     * @param {SatPoint} satpoint
     * @returns {Promise<{ret: number}>}
     */
    async add_new_inscription(
        inscription_id,
        inscription_number,
        block_height,
        timestamp,
        creator_address,
        satpoint,
        value,
        op,
    ) {
        assert(_.isString(inscription_id), `invalid inscription_id`);
        assert(_.isNumber(inscription_number), `invalid inscription_number`);
        assert(_.isNumber(block_height), `invalid block_height`);
        assert(_.isNumber(timestamp), `invalid timestamp`);
        assert(_.isString(creator_address), `invalid creator address`);
        assert(
            satpoint instanceof SatPoint,
            `invalid satpoint on add_new_inscription`,
        );
        assert(_.isNumber(value), `invalid value`);
        assert(InscriptionOp.contains(op), `invalid op ${op}`);

        const { ret } = await this._on_inscription_transfer(
            inscription_id,
            inscription_number,
            block_height,
            timestamp,
            satpoint,
            null, // creator transaction's from address is null
            creator_address,
            value,
            0,
            op,
        );
        if (ret !== 0) {
            console.error(
                `failed to add new inscription ${inscription_id}, ${inscription_number}, block ${block_height}, ${satpoint}, ${creator_address}`,
            );
            return { ret };
        }

        return { ret: 0 };
    }

    /**
     * The inscription content is contained within the input of a reveal transaction, and the inscription is made on the first sat of its input. This sat can then be tracked using the familiar rules of ordinal theory, allowing it to be transferred, bought, sold, lost to fees, and recovered.
     * @param {string} inscription_id
     * @returns {Promise<{ret: number, satpoint: SatPoint, address: string, value: number, commit_txid: string}>}
     */
    async calc_create_satpoint(inscription_id) {
        let {
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
            console.error(
                `invalid index ${index} >= ${tx.vin.length} in tx ${txid} ${inscription_id}`,
            );
            index = tx.vin.length - 1;
        }

        assert(
            index < tx.vin.length,
            `invalid index ${inscription_id} ${index} >= ${tx.vin.length}`,
        );
        const vin = tx.vin[index];
        const commit_txid = vin.txid;
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
            `found creator satpoint ${inscription_id} ${point.to_string()}, address: ${address}, value: ${value}, commit txid: ${commit_txid}`,
        );

        return { ret: 0, satpoint: point, address, value, commit_txid };
    }

    /**
     *
     * @param {number} block_height
     * @param {InscriptionsStorage} inscription_storage
     * @returns {Promise<{ret: number, transfer_items: Array<InscriptionTransferRecordItem>}>}
     */
    async process_block(block_height, inscription_storage) {
        assert(_.isNumber(block_height), `invalid block_height`);
        assert(
            inscription_storage instanceof InscriptionsStorage,
            `invalid inscription_storage`,
        );

        const { ret, block } = await this.btc_client.get_block(block_height);
        if (ret !== 0) {
            console.error(`failed to get block ${block_height}`);
            return { ret };
        }

        // batch get by get_transaction_batch
        const { ret: batch_get_ret, txs } =
            await this.btc_client.get_transaction_batch(block.tx);
        if (batch_get_ret !== 0) {
            console.error(`failed to get transaction batch`);
            return { ret: batch_get_ret };
        }

        const transfer_items = [];
        for (let i = 0; i < txs.length; ++i) {
            const tx = txs[i];
            const tx_item = new TxSimpleItem(tx);

            // check all input in current tx if match any inscription outpoint
            for (let j = 0; j < tx_item.vin.length; ++j) {
                const outpoint_str = tx_item.vin[j];

                // check if current outpoint is included in this tx's input, if exists, 
                // then it's a transfer, we should update the transfer record and remove it from monitor list
                const inscriptions = this.inscriptions.get_and_remove_array(outpoint_str);
                if (inscriptions == null) {
                    continue;
                }

                for (let k = 0; k < inscriptions.length; ++k) {
                    const inscription = inscriptions[k];

                    console.log(
                        `found inscription ${inscription.inscription_id} transfer at block ${block_height} ${outpoint_str}`,
                    );

                    const { ret: parse_ret, satpoint } = SatPoint.parse(
                        inscription.satpoint,
                    );
                    assert(
                        parse_ret === 0,
                        `invalid satpoint ${inscription.satpoint} on monitor.process_block`,
                    );

                    // calc next satpoint
                    const { ret, point, address, value } =
                        await tx_item.calc_next_satpoint(
                            satpoint,
                            this.utxo_cache,
                        );
                    if (ret !== 0) {
                        console.error(
                            `failed to calc inscription next satpoint ${inscription.inscription_id} ${inscription.satpoint}`,
                        );
                        return { ret };
                    }

                    // load content from inscription storage
                    const { ret: load_ret, data: inscription_data } =
                        await inscription_storage.get_inscription(
                            inscription.inscription_id,
                        );
                    if (load_ret !== 0) {
                        console.error(
                            `failed to load content ${inscription.inscription_id}`,
                        );
                        return { ret: load_ret };
                    }

                    // parse content without check, the content stored in db must be valid!
                    assert(
                        _.isString(inscription_data.content),
                        `invalid content from inscription storage`,
                    );
                    const content = JSON.parse(inscription_data.content);
                    const {
                        ret: parse_content_ret,
                        valid,
                        item: op,
                    } = InscriptionContentLoader.parse_content_without_check(
                        inscription.inscription_id,
                        content,
                    );
                    if (parse_content_ret !== 0) {
                        console.error(
                            `failed to parse content ${
                                inscription.inscription_id
                            } ${JSON.stringify(content)}`,
                        );
                        return { ret: parse_content_ret };
                    }

                    assert(valid);
                    assert(_.isObject(op));

                    if (point != null) {
                        console.log(
                            `found inscription transfer ${
                                inscription.inscription_id
                            } ${inscription.satpoint} -> ${point.to_string()}`,
                        );

                        const { ret } = await this._on_inscription_transfer(
                            inscription.inscription_id,
                            inscription.inscription_number,
                            block_height,
                            block.time,
                            point,
                            inscription.to_address,
                            address,
                            value,
                            inscription.index + 1,
                            inscription.op,
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
                        // inscription is spent as fee
                        console.warn(
                            `inscription ${inscription.inscription_id} is spent as fee on tx ${tx.txid}`,
                        );

                        const { ret } =
                            await this._on_inscription_transfer_as_fee(
                                inscription.inscription_id,
                                inscription.inscription_number,
                                block_height,
                                block.time,
                                inscription.to_address,
                                inscription.index + 1,
                                inscription.op,
                            );

                        if (ret !== 0) {
                            console.error(
                                `failed to process inscription transfer as fee ${inscription.inscription_id} block ${block_height}`,
                            );
                            return { ret };
                        }
                    }

                    if (point != null) {
                        const transfer_item = new InscriptionTransferItem(
                            inscription.inscription_id,
                            inscription.inscription_number,
                            block_height,
                            block.time,
                            point,
                            inscription.to_address,
                            address,
                            value == null ? 0 : value,
                            content,
                            op,
                            inscription.index + 1,
                        );

                        transfer_items.push(transfer_item);
                    } else {
                        // FIXME only process the normal transfer, ignore the transfer as fee
                    }
                }
            }
        }

        return { ret: 0, transfer_items };
    }

    async _on_inscription_transfer(
        inscription_id,
        inscription_number,
        block_height,
        timestamp,
        satpoint,
        from_address,
        to_address,
        value,
        index, // index Indicates the number of transfers
        op,
    ) {
        assert(_.isString(inscription_id), `invalid inscription_id`);
        assert(_.isNumber(inscription_number), `invalid inscription_number`);
        assert(
            _.isNumber(block_height),
            `invalid block_height ${block_height}`,
        );
        assert(_.isNumber(timestamp), `invalid timestamp ${timestamp}`);
        assert(
            satpoint instanceof SatPoint,
            `invalid satpoint on monitor._on_inscription_transfer`,
        );
        assert(
            from_address == null || _.isString(from_address),
            `invalid from_address`,
        );
        assert(_.isString(to_address), `invalid to_address`);
        assert(_.isNumber(value), `invalid value ${value}`);
        assert(_.isNumber(index), `invalid index ${index}`);
        assert(InscriptionOp.contains(op), `invalid op ${op}`);

        // update db
        const { ret } = await this.storage.insert_transfer(
            inscription_id,
            inscription_number,
            block_height,
            timestamp,
            satpoint.to_string(),
            from_address,
            to_address,
            value,
            index,
            op,
        );
        if (ret !== 0) {
            console.error(
                `failed to add inscription transfer ${inscription_id} block ${block_height} ${satpoint.to_string()} ${from_address} -> ${to_address}`,
            );
            return { ret };
        }

        // only cache the transfer record if we should track it
        if (InscriptionOp.need_track_transfer(op)) {
            // update cache
            const new_item = new InscriptionTransferRecordItem(
                inscription_id,
                inscription_number,
                block_height,
                timestamp,
                satpoint.to_string(),
                from_address,
                to_address,
                index,
                op,
            );

            const outpoint_str = satpoint.outpoint.to_string();

            /*
            const current_item = this.inscriptions.get(outpoint_str);
            if (current_item != null) {
                assert(
                    current_item.is_equal(new_item),
                    `invalid inscription transfer ${JSON.stringify(
                        current_item,
                    )} ${JSON.stringify(new_item)}`,
                );
                return { ret: 0 };
            }
            */

            this.inscriptions.set(outpoint_str, new_item);
        }

        return { ret: 0 };
    }

    // the inscription is spent as fee, like this "58a58d5ccbf032c4ec94decf73531de4fb3d9b073ddcbf1abcdbe7c61b5cd587i0"
    async _on_inscription_transfer_as_fee(
        inscription_id,
        inscription_number,
        block_height,
        timestamp,
        from_address,
        index, // index Indicates the number of transfers
        op,
    ) {
        assert(_.isString(inscription_id), `invalid inscription_id`);
        assert(_.isNumber(inscription_number), `invalid inscription_number`);
        assert(
            _.isNumber(block_height),
            `invalid block_height ${block_height}`,
        );
        assert(_.isNumber(timestamp), `invalid timestamp ${timestamp}`);
        assert(
            from_address == null || _.isString(from_address),
            `invalid from_address`,
        );
        assert(_.isNumber(index), `invalid index ${index}`);
        assert(InscriptionOp.contains(op), `invalid op ${op}`);

        // update db
        const { ret } = await this.storage.insert_transfer(
            inscription_id,
            inscription_number,
            block_height,
            timestamp,
            Util.zero_satpoint(),
            from_address,
            Util.zero_btc_address(),
            0,
            index,
            op,
        );
        if (ret !== 0) {
            console.error(
                `failed to add inscription transfer to fee ${inscription_id} block ${block_height} ${from_address}`,
            );
            return { ret };
        }

        // TODO do not cache this inscription any more?

        return { ret: 0 };
    }
}

module.exports = { InscriptionTransferMonitor };
