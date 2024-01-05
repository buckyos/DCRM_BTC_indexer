const { BigNumberUtil } = require('../../util');
const { TokenIndexStorage } = require('../../storage/token');
const assert = require('assert');
const { InscriptionOpState, InscriptionStage } = require('./state');
const { InscriptionTransferItem, InscriptionNewItem } = require('../item');

class TransferOperator {
    constructor(storage) {
        assert(
            storage instanceof TokenIndexStorage,
            `storage should be TokenIndexStorage`,
        );

        this.storage = storage;
    }

    /**
     * @comment processed on the inscription is inscribed
     * @param {InscriptionNewItem} inscription_item
     */
    async on_inscribe(inscription_item) {
        assert(inscription_item instanceof InscriptionNewItem, `invalid item`);

        const { ret } = await this.storage.add_transfer_record_on_inscribed(
            inscription_item.inscription_id,
            inscription_item.block_height,
            inscription_item.timestamp,
            inscription_item.txid,
            inscription_item.address,
            JSON.stringify(inscription_item.content),
            InscriptionOpState.OK,
        );
        if (ret !== 0) {
            console.error(
                `failed to record transfer on inscribed ${inscription_item.inscription_id} ${inscription_item.address}`,
            );
            return { ret };
        }

        console.log(
            `record transfer inscribe ${inscription_item.block_height} ${
                inscription_item.inscription_id
            } ${inscription_item.address} ${JSON.stringify(
                inscription_item.content,
            )}`,
        );

        return { ret: 0 };
    }

    /**
     * @comment notify on the inscription is transferred, only the firs time transfer will be handled by token index
     * @param {InscriptionTransferItem} inscription_item
     * @returns {Promise<{ret: number}>}
     */
    async on_transfer(inscription_transfer_item) {
        assert(
            inscription_transfer_item instanceof InscriptionTransferItem,
            `invalid item`,
        );

        assert(
            inscription_transfer_item.index > 0,
            `invalid transfer index ${inscription_transfer_item.inscription_id}`,
        );

        // only process on first transfer
        if (inscription_transfer_item.index > 1) {
            console.warn(
                `ignore transfer ${inscription_transfer_item.block_height} ${inscription_transfer_item.inscription_id} ${inscription_transfer_item.from_address} -> ${inscription_transfer_item.to_address}, ${inscription_transfer_item.index}`,
            );
            return { ret: 0 };
        }

        // first query the inscription at the inscribed stage
        const { ret: get_inscribed_ret, data: inscription_item } =
            await this.storage.query_transfer_record(
                inscription_transfer_item.inscription_id,
                InscriptionStage.Inscribe,
            );
        if (get_inscribed_ret !== 0) {
            console.error(
                `failed to query transfer record ${inscription_transfer_item.inscription_id}`,
            );
            return { ret: get_inscribed_ret };
        }

        if (inscription_item == null) {
            console.error(
                `query transfer inscribe record but not found: ${inscription_transfer_item.inscription_id}`,
            );
            return { ret: 0 };
        }

        assert(
            inscription_item.inscription_id ===
                inscription_transfer_item.inscription_id,
            `inscription_id should be the same: ${inscription_item.inscription_id} !== ${inscription_transfer_item.inscription_id}`,
        );
        assert(
            inscription_transfer_item.from_address ===
                inscription_item.from_address,
            `from_address should be the same as the inscription creator address: ${inscription_item.inscription_id} ${inscription_transfer_item.from_address} ${inscription_item.from_address}`,
        );

        // parse content in JSON format
        const content = JSON.parse(inscription_item.content);
        assert(_.isString(content.amt), `amt should be set as string`);

        inscription_item.to_address = inscription_transfer_item.to_address;
        inscription_item.block_height = inscription_transfer_item.block_height;
        inscription_item.timestamp = inscription_transfer_item.timestamp;
        inscription_item.txid = inscription_transfer_item.txid;

        // do transfer
        const { ret, state } = await this._transfer(
            inscription_item,
            inscription_transfer_item.content,
        );
        if (ret !== 0) {
            return { ret };
        }

        // record transfer op
        const { ret: record_ret } =
            await this.storage.add_transfer_record_on_transferred(
                inscription_item.inscription_id,

                inscription_item.genesis_block_height,
                inscription_item.genesis_timestamp,
                inscription_item.genesis_txid,
                inscription_item.from_address,
                inscription_item.content,

                inscription_item.block_height,
                inscription_item.timestamp,
                inscription_item.txid,
                inscription_item.to_address,

                state,
            );
        if (record_ret !== 0) {
            console.error(
                `failed to record transfer ${inscription_item.inscription_id} ${inscription_item.from_address} -> ${inscription_item.to_address} ${content.amt}`,
            );
            return { ret: record_ret };
        }

        return { ret: 0 };
    }

    async _transfer(inscription_item, content) {
        assert(_.isObject(content), `content should be object`);
        assert(
            BigNumberUtil.is_positive_number_string(content.amt),
            `amt should be valid number string ${content.amt}`,
        );
        assert(
            _.isString(inscription_item.from_address),
            `from_address should be string`,
        );
        assert(
            _.isString(inscription_item.to_address),
            `output_address should be string`,
        );

        // 1. check if the address is the same as the output address
        if (inscription_item.from_address === inscription_item.to_address) {
            console.info(
                `ignore transfer to self ${inscription_item.inscription_id} ${inscription_item.to_address}`,
            );
            return { ret: 0, state: InscriptionOpState.OK };
        }

        // 2. check if has enough balance
        const { ret: get_balance_ret, amount: balance } =
            await this.storage.get_balance(inscription_item.from_address);
        if (get_balance_ret !== 0) {
            console.error(
                `failed to get balance ${inscription_item.inscription_id} ${inscription_item.from_address}`,
            );
            return { get_balance_ret };
        }

        assert(_.isString(balance), `balance should be string ${balance}`);

        if (BigNumberUtil.compare(balance, content.amt) < 0) {
            console.warn(
                `not enough balance ${inscription_item.inscription_id} ${inscription_item.from_address} -> ${inscription_item.to_address} ${balance} < ${content.amt}`,
            );
            return { ret: 0, state: InscriptionOpState.INSUFFICIENT_BALANCE };
        }

        // 3. transfer indeed
        const { ret } = await this.storage.transfer_balance(
            inscription_item.from_address,
            inscription_item.to_address,
            content.amt,
        );
        if (ret !== 0) {
            assert(ret < 0);

            console.error(
                `failed to transfer ${inscription_item.inscription_id} ${inscription_item.from_address} -> ${inscription_item.to_address} ${content.amt}}`,
            );
            return { ret };
        }

        console.info(
            `transfer ${inscription_item.inscription_id} ${inscription_item.from_address} -> ${inscription_item.to_address} ${content.amt}`,
        );

        return { ret: 0, state: InscriptionOpState.OK };
    }
}

module.exports = { TransferOperator };
