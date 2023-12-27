const assert = require('assert');
const { Util } = require('../../util');
const { TokenIndex } = require('../../storage/token');
const { HashHelper } = require('./hash');
const {InscriptionOpState} = require('./state');

class SetPriceOperator {
    constructor(storage, hash_helper) {
        assert(storage instanceof TokenIndex, `storage should be TokenIndex`);
        assert(
            hash_helper instanceof HashHelper,
            `hash_helper should be HashHelper`,
        );

        this.storage = storage;
        this.hash_helper = hash_helper;
    }

    async on_set_price(inscription_item) {

        // do set price
        const { ret, state } = await this._set_price(inscription_item);
        if (ret !== 0) {
            return { ret };
        }

        // record set price op
        const { ret: record_ret } = await this.storage.add_set_price_record(
            inscription_item.inscription_id,
            inscription_item.block_height,
            inscription_item.timestamp,
            inscription_item.content.ph,
            inscription_item.address,
            state,
        );
        if (record_ret !== 0) {
            console.error(
                `failed to record set price ${inscription_item.inscription_id} ${inscription_item.address} ${content.ph} ${content.amt}`,
            );
            return { ret: record_ret };
        }

        return { ret: 0 };
    }

    async _set_price(inscription_item) {
        const content = inscription_item.content;

        // 1. first check if hash and amt field is exists and valid
        const hash = content.ph;
        if (hash == null || !_.isString(hash)) {
            console.warn(
                `invalid inscription ph ${inscription_item.inscription_id} ${hash}`,
            );

            // invalid format, so we should ignore this inscription
            return { ret: 0 };
        }

        let price = content.price;
        if (price == null || !_.isNumber(price)) {
            console.error(
                `invalid set_price price ${inscription_item.inscription_id} ${price}`,
            );
            return { ret: 0 };
        }

        // 2. check if hash's owner is the same
        const {ret: get_ret, data} = await this.storage.get_inscribe_data(hash);
        if (get_ret !== 0) {
            console.error(
                `failed to get inscribe data ${inscription_item.inscription_id} ${hash}`,
            );
            return { ret: get_ret };
        }

        if (data == null) {
            console.error(
                `inscribe data not exists ${inscription_item.inscription_id} ${hash}`,
            );
            return { ret: 0, state: InscriptionOpState.HASH_NOT_FOUND };
        }

        if (data.address !== inscription_item.address) {
            console.error(
                `inscribe data owner not match ${inscription_item.inscription_id} ${hash} ${data.address} != ${inscription_item.address}`,
            );
            return { ret: 0, state: InscriptionOpState.PERMISSION_DENIED };
        }

        // 3. check price, should less than weight * 2
        // calc hash weight
        const { ret: calc_ret, weight: hash_weight } =
            await this.hash_helper.query_hash_weight(
                inscription_item.timestamp,
                hash,
            );
        if (calc_ret !== 0) {
            console.error(
                `failed to calc hash weight ${inscription_item.inscription_id} ${hash}`,
            );
            return { ret: calc_ret };
        }

        // check and try fix price
        if (price > hash_weight * 2) {
            console.warn(`price is too large ${inscription_item.inscription_id} ${price} > ${hash_weight} * 2`);
            price = hash_weight * 2;
        }

        // 3. set price for hash
        const {ret: set_ret } = await this.storage.set_inscribe_data_price(hash, price);
        if (set_ret !== 0) {
            console.error(
                `failed to set price ${inscription_item.inscription_id} ${hash} ${price}`,
            );
            return { ret: set_ret };
        }

        console.log(`set price ${inscription_item.inscription_id} ${hash} ${price}`);

        return { ret: 0, state: InscriptionOpState.OK };
    }
}

module.exports = { SetPriceOperator };