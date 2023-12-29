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

    async load_all() {
        const { ret, records } = await this.storage.get_all_transfer();
        if (ret !== 0) {
            console.error(`failed to get all transfer`);
            return { ret };
        }

        for (let i = 0; i < records.length; ++i) {
            const record = records[i];
            const item = InscriptionTransferRecordItem.from_db_record(record);
            assert(
                this.inscriptions.get(item.satpoint) == null,
                `satpoint ${item.satpoint} already exists`,
            );

            const { ret, point } = SatPoint.parse(item.satpoint);
            assert(ret === 0, `invalid satpoint ${item.satpoint}`);
            assert(point != null, `invalid satpoint ${item.satpoint}`);

            // index by outpoint
            const outpoint_str = point.outpoint.to_string();
            assert(
                this.inscriptions.get(outpoint_str) == null,
                `outpoint ${outpoint_str} already exists`,
            );
            this.inscriptions.set(outpoint_str, item);
        }

        console.log(`loaded all inscriptions: ${this.inscriptions.size}`);
        return { ret: 0 };
    }

    // add new inscription on inscription index scanner, then we can monitor it
    // it's the firt step to monitor a new inscription, and it's the first transfer record
    async add_new_inscription(
        inscription_id,
        block_height,
        timestamp,
        creator_address,
        satpoint,
    ) {
        assert(_.isString(inscription_id), `invalid inscription_id`);
        assert(_.isNumber(block_height), `invalid block_height`);
        assert(_.isNumber(timestamp), `invalid timestamp`);
        assert(_.isString(creator_address), `invalid creator address`);
        assert(_.isString(satpoint), `invalid satpoint`);

        const { ret } = await this._on_inscription_transfer(
            inscription_id,
            block_height,
            timestamp,
            satpoint,
            creator_address,
        );
        if (ret !== 0) {
            console.error(
                `failed to add new inscription ${inscription_id}, block ${block_height}, ${satpoint}, ${creator_address}`,
            );
            return { ret };
        }

        return { ret: 0 };
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
                const vin = tx_item.vin[j];
                const outpoint = new OutPoint(vin.txid, vin.vout);
                const outpoint_str = outpoint.to_string();

                const inscription = this.inscriptions.get(outpoint_str);
                if (inscription == null) {
                    continue;
                }

                console.log(
                    `found inscription ${inscription.inscription_id} transfer at block ${block_height} ${outpoint_str}`,
                );

                // calc next satpoint
                const { ret, point, address } =
                    await tx_item.calc_next_satpoint(
                        inscription.satpoint,
                        this.utxo_cache,
                    );
                if (ret !== 0) {
                    console.error(
                        `failed to calc inscription next satpoint ${
                            inscription.inscription_id
                        } ${inscription.satpoint.to_string()}`,
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
                        block.blocktime,
                        point,
                        address,
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
    ) {
        assert(_.isString(inscription_id), `invalid inscription_id`);
        assert(
            _.isNumber(block_height),
            `invalid block_height ${block_height}`,
        );
        assert(_.isNumber(timestamp), `invalid timestamp ${timestamp}`);
        assert(satpoint instanceof SatPoint, `invalid satpoint`);
        assert(_.isString(address), `invalid address ${address}`);

        // update db
        const { ret } = await this.storage.insert_transfer(
            inscription_id,
            block_height,
            timestamp,
            satpoint.to_string(),
            address,
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
        assert(
            this.inscriptions.get(outpoint_str) == null,
            `outpoint ${outpoint_str} already exists`,
        );
        this.inscriptions.set(outpoint_str, new_item);

        return { ret: 0 };
    }
}

module.exports = { InscriptionTransferMonitor };

