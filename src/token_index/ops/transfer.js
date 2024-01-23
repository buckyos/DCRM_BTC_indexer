const { BigNumberUtil } = require('../../util');
const { TokenIndexStorage } = require('../../storage/token');
const assert = require('assert');
const { InscriptionOpState, InscriptionStage } = require('./state');
const {
    InscriptionTransferItem,
    InscriptionNewItem,
} = require('../../index/item');

class TransferOperator {
    constructor(config, storage) {
        assert(
            storage instanceof TokenIndexStorage,
            `storage should be TokenIndexStorage`,
        );
        assert(_.isObject(config), `config should be object`);
        assert(
            _.isString(config.token.account.exchange_address),
            `config.token.account.exchange_address should be string`,
        );

        this.config = config;
        this.storage = storage;
        this.balance_storage = storage.get_balance_storage();
    }

    /**
     * @comment processed on the inscription is inscribed
     * @param {InscriptionNewItem} inscription_item
     */
    async on_inscribe(inscription_item) {
        assert(inscription_item instanceof InscriptionNewItem, `invalid item`);
        assert(
            _.isObject(inscription_item.content),
            `invalid content ${JSON.stringify(inscription_item.content)}`,
        );

        // process the transfer inscribe
        const { ret, state } = await this._inscribe(inscription_item);
        if (ret !== 0) {
            return { ret };
        }

        const { ret: add_ret } =
            await this.storage.add_transfer_record_on_inscribed(
                inscription_item.inscription_id,
                inscription_item.block_height,
                inscription_item.timestamp,
                inscription_item.txid,
                inscription_item.address,
                JSON.stringify(inscription_item.content),
                state,
            );
        if (add_ret !== 0) {
            console.error(
                `failed to record transfer on inscribed ${inscription_item.inscription_id} ${inscription_item.address}`,
            );
            return { ret: add_ret };
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
     * @comment process the transfer inscribe, and update the transferable balance if success
     * @param {InscriptionNewItem} inscription_item
     * @returns {Promise<{ret: number}>}
     */
    async _inscribe(inscription_item) {
        // first check content params
        const amt = inscription_item.content.amt;

        // check amt
        if (!BigNumberUtil.is_positive_number_string(amt)) {
            console.warn(
                `invalid transfer content amt ${amt} ${JSON.stringify(
                    inscription_item.content,
                )}`,
            );
            return { ret: 0, state: InscriptionOpState.INVALID_PARAMS };
        }

        // check if has enough available balance
        const { ret: get_balance_ret, amount: balance } =
            await this.balance_storage.get_available_balance(
                inscription_item.address,
            );
        if (get_balance_ret !== 0) {
            console.error(
                `failed to get available balance ${inscription_item.address}`,
            );
            return { ret: get_balance_ret };
        }

        assert(_.isString(balance), `balance should be string ${balance}`);
        if (BigNumberUtil.compare(balance, amt) < 0) {
            console.warn(
                `not enough available balance for ${inscription_item.address} ${balance} < ${amt}`,
            );
            return { ret: 0, state: InscriptionOpState.INSUFFICIENT_BALANCE };
        }

        // update the transferable balance
        const { ret: update_balance_ret } =
            await this.balance_storage.update_transferable_balance(
                inscription_item.address,
                amt,
            );
        if (update_balance_ret !== 0) {
            console.error(
                `failed to update transferable balance ${inscription_item.address} ${amt}`,
            );
            return { ret: update_balance_ret };
        }

        console.log(
            `inscribe transfer ${inscription_item.address}, ${inscription_item.inscription_id}, ${amt}`,
        );
        return { ret: 0, state: InscriptionOpState.OK };
    }

    /**
     * @comment notify on the inscription is transferred, only the first time transfer will be handled by token index
     * @param {InscriptionTransferItem} inscription_item
     * @returns {Promise<{ret: number}>}
     */
    async on_transfer(inscription_transfer_item) {
        assert(
            inscription_transfer_item instanceof InscriptionTransferItem,
            `invalid item`,
        );
        assert(
            _.isObject(inscription_transfer_item.content),
            `invalid content`,
        );

        // only process on first transfer
        if (inscription_transfer_item.index > 1) {
            console.warn(
                `ignore transfer ${inscription_transfer_item.block_height} ${inscription_transfer_item.inscription_id} ${inscription_transfer_item.from_address} -> ${inscription_transfer_item.to_address}, ${inscription_transfer_item.index}`,
            );
            return { ret: 0 };
        }

        // process the transfer inscribe
        const { ret, state } = await this._on_transfer(
            inscription_transfer_item,
        );
        if (ret !== 0) {
            return { ret };
        }

        assert(_.isNumber(state), `state should be number ${state}`);

        // record transfer op
        const { ret: record_ret } =
            await this.storage.update_transfer_record_on_transferred(
                inscription_transfer_item.inscription_id,
                inscription_transfer_item.from_address,

                inscription_transfer_item.block_height,
                inscription_transfer_item.timestamp,
                inscription_transfer_item.txid,
                inscription_transfer_item.to_address,

                state,
            );
        if (record_ret !== 0) {
            console.error(
                `failed to record transfer ${inscription_transfer_item.inscription_id} ${inscription_transfer_item.from_address} -> ${inscription_transfer_item.to_address} ${inscription_transfer_item.content.amt}`,
            );
            return { ret: record_ret };
        }

        console.log(
            `record transfer ${inscription_transfer_item.inscription_id} ${inscription_transfer_item.from_address} -> ${inscription_transfer_item.to_address} ${inscription_transfer_item.content.amt}`,
        );
        return { ret: 0 };
    }

    /**
     * @comment notify on the inscription is transferred, only the first time transfer will be handled by token index
     * @param {InscriptionTransferItem} inscription_item
     * @returns {Promise<{ret: number, state: number}>}
     */
    async _on_transfer(inscription_transfer_item) {
        assert(
            inscription_transfer_item.index === 1,
            `invalid transfer index ${inscription_transfer_item.inscription_id}`,
        );

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
            return { ret: 0, state: InscriptionOpState.RECORD_NOT_FOUND };
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

        // check the state of the inscribe inscription, we only handle the inscription with state OK
        if (inscription_item.state !== InscriptionOpState.OK) {
            console.warn(
                `invalid inscription state ${inscription_item.inscription_id} ${inscription_item.state}`,
            );
            return { ret: 0, state: inscription_item.state };
        }

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

        return { ret: 0, state };
    }

    /**
     *
     * @param {object} inscription_item
     * @param {object} content
     * @returns {Promise<{ret: number, state: number}>}
     */
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

        // recover the transferable balance of from address
        const { ret: update_ret } =
            await this.balance_storage.update_transferable_balance(
                inscription_item.from_address,
                BigNumberUtil.multiply(content.amt, '-1'),
            );
        if (update_ret < 0) {
            console.error(
                `failed to update transferable balance ${inscription_item.from_address} ${content.amt}`,
            );
            return { ret: update_ret };
        }

        // FIXME: should not happen
        if (update_ret > 0) {
            assert(
                update_ret === InscriptionOpState.INSUFFICIENT_BALANCE,
                `invalid update_ret ${update_ret}`,
            );

            console.warn(
                `insufficient transferable balance ${inscription_item.from_address} ${content.amt}`,
            );
            return { ret: 0, state: InscriptionOpState.INSUFFICIENT_BALANCE };
        }

        // check if the address is the same as the output address
        if (inscription_item.from_address === inscription_item.to_address) {
            console.info(
                `transfer to self ${inscription_item.inscription_id} ${inscription_item.to_address}`,
            );

            return { ret: 0, state: InscriptionOpState.OK };
        }

        // transfer to the output address
        const { ret: transfer_ret } =
            await this.balance_storage.transfer_balance(
                inscription_item.from_address,
                inscription_item.to_address,
                content.amt,
            );

        if (transfer_ret < 0) {
            console.error(
                `failed to transfer ${inscription_item.inscription_id} ${inscription_item.from_address} -> ${inscription_item.to_address} ${content.amt}}`,
            );
            return { ret: transfer_ret };
        }

        // FIXME: should not happen
        if (transfer_ret > 0) {
            assert(
                transfer_ret === InscriptionOpState.INSUFFICIENT_BALANCE,
                `invalid transfer_ret ${transfer_ret}`,
            );

            console.warn(
                `insufficient balance ${inscription_item.from_address} ${content.amt}`,
            );
            return { ret: 0, state: InscriptionOpState.INSUFFICIENT_BALANCE };
        }

        // if to_address is the exchange address, then send amt inner token to from_address
        if (
            inscription_item.to_address ===
            this.config.token.account.exchange_address
        ) {
            // transfer to mint pool
            console.info(
                `exchange inner token ${inscription_item.inscription_id} ${inscription_item.from_address} ${content.amt}`,
            );

            // add content.amt to inner balance, the whole amount(brc-20 token + inner token) should not changed?
            const { ret } = await this.balance_storage.update_inner_balance(
                inscription_item.from_address,
                content.amt,
            );
            if (ret !== 0) {
                console.error(
                    `failed to update inner balance ${inscription_item.from_address} ${content.amt}`,
                );
                return { ret };
            }
        }

        console.info(
            `transfer ${inscription_item.inscription_id} ${inscription_item.from_address} -> ${inscription_item.to_address} ${content.amt}`,
        );

        return { ret: 0, state: InscriptionOpState.OK };
    }
}

module.exports = { TransferOperator };
