const { Util } = require('../../util');
const { TokenIndexStorage } = require('../../storage/token');
const assert = require('assert');
const { InscriptionOpState } = require('./state');


class TransferManager {
    constructor(storage) {
        assert(
            storage instanceof TokenIndexStorage,
            `storage should be TokenIndexStorage`,
        );

        this.storage = storage;
    }

    async on_transfer(inscription_item) {
        const content = inscription_item.content;
        assert(content.to != null, `to should be exists`);
        assert(_.isString(content.to), `to should be string`);

        // do transfer
        const { ret, state } = await this._transfer(inscription_item);
        if (ret !== 0) {
            return { ret };
        }

        // record transfer op
        const { ret: record_ret } = await this.storage.add_transfer_record(
            inscription_item.inscription_id,
            inscription_item.block_height,
            inscription_item.address,
            inscription_item.output_address,
            state,
        );
        if (record_ret !== 0) {
            console.error(
                `failed to record transfer ${inscription_item.inscription_id} ${inscription_item.address} -> ${content.to} ${content.amt}`,
            );
            return { ret: record_ret };
        }

        return { ret: 0 };
    }

    async _transfer(inscription_item) {
        const content = inscription_item.content;
        assert(
            _.isString(inscription_item.output_address),
            `output_address should be string`,
        );

        // 1. check if the address is the same as the output address
        if (inscription_item.address === inscription_item.output_address) {
            console.log(
                `ignore transfer to self ${inscription_item.inscription_id} ${inscription_item.address}`,
            );
            return { ret: 0, state: 0 };
        }

        // 2. check if has enough balance
        const { ret: get_balance_ret, balance } =
            await this.storage.get_balance(inscription_item.address);
        if (get_balance_ret !== 0) {
            console.error(
                `failed to get balance ${inscription_item.inscription_id} ${inscription_item.address}`,
            );
            return { get_balance_ret };
        }

        if (balance < content.amt) {
            console.error(
                `not enough balance ${inscription_item.inscription_id} ${inscription_item.address} ${balance} < ${content.amt}`,
            );
            return { ret: 0, state: InscriptionOpState.INSUFFICIENT_BALANCE };
        }

        // 3. transfer indeed
        const { ret } = await this.storage.transfer_balance(
            inscription_item.address,
            inscription_item.output_address,
            content.amt,
        );
        if (ret !== 0) {
            console.error(
                `failed to transfer ${inscription_item.inscription_id} ${inscription_item.address} -> ${inscription_item.output_address} ${content.amt}}`,
            );
            return { ret };
        }

        console.log(
            `transfer ${inscription_item.inscription_id} ${inscription_item.address} -> ${inscription_item.output_address} ${content.amt}}`,
        );

        return { ret: 0, state: InscriptionOpState.OK };
    }
}
