const assert = require('assert');
const { BigNumberUtil } = require('../../util');
const { TokenIndexStorage } = require('../../storage/token');
const { HashHelper } = require('./hash');
const { InscriptionOpState } = require('./state');
const { InscriptionNewItem } = require('../../index/item');
const { Util } = require('../../util');

class SetPriceOperator {
    constructor(storage, hash_helper) {
        assert(
            storage instanceof TokenIndexStorage,
            `storage should be TokenIndex`,
        );
        assert(
            hash_helper instanceof HashHelper,
            `hash_helper should be HashHelper`,
        );

        this.storage = storage;
        this.hash_helper = hash_helper;
    }

    /**
     *
     * @param {InscriptionNewItem} inscription_item
     * @returns {Promise<{ret: number}>}
     */
    async on_set_price(inscription_item) {
        assert(inscription_item instanceof InscriptionNewItem, `invalid item`);
        assert(_.isObject(inscription_item.content), `invalid content`);

        // do set price
        const { ret, state } = await this._set_price(inscription_item);
        if (ret !== 0) {
            return { ret };
        }

        // record set price op for any state
        const { ret: record_ret } = await this.storage.add_set_price_record(
            inscription_item.inscription_id,
            inscription_item.block_height,
            inscription_item.timestamp,
            inscription_item.txid,
            JSON.stringify(inscription_item.content),
            inscription_item.hash,  // use inscription_item.hash instead of inscription_item.content.ph
            inscription_item.address,
            inscription_item.price, // use inscription_item.price instead of inscription_item.content.price
            inscription_item.hash_point,
            inscription_item.hash_weight,
            state,
        );
        if (record_ret !== 0) {
            console.error(
                `failed to record set price ${inscription_item.inscription_id} ${inscription_item.address} ${inscription_item.hash} ${inscription_item.content.amt}`,
            );
            return { ret: record_ret };
        }

        return { ret: 0 };
    }

    /**
     *
     * @param {InscriptionNewItem} inscription_item
     * @returns {Promise<{ret: number, state: InscriptionOpState}>}
     */
    async _set_price(inscription_item) {
        const content = inscription_item.content;

        //  set to default value on start
        inscription_item.hash_point = 0;
        inscription_item.hash_weight = '0';
        inscription_item.price = '0';
        inscription_item.hash = '';

        // 1. first check if hash and amt field is exists and valid
        const hash = content.ph;
        if (hash == null || !_.isString(hash)) {
            console.warn(
                `invalid inscription ph ${inscription_item.inscription_id} ${hash}`,
            );

            // invalid format, so we should ignore this inscription
            return { ret: 0, state: InscriptionOpState.INVALID_PARAMS };
        }

        if (!Util.is_valid_mixhash(hash)) {
            console.warn(
                `invalid inscribe content ph ${hash}, ${inscription_item.inscription_id}`,
            );
            return { ret: 0, state: InscriptionOpState.INVALID_PARAMS };
        }
        assert(Util.is_valid_hex_mixhash(hash), `invalid hex mixhash ${hash}`);
        inscription_item.hash = hash;

        let price = content.price;
        if (!BigNumberUtil.is_positive_number_string(price)) {
            console.error(
                `invalid set_price price ${inscription_item.inscription_id} ${price}`,
            );
            return { ret: 0, state: InscriptionOpState.INVALID_PARAMS };
        }
        inscription_item.price = price;

        // 2. check if hash is exists already and hash's owner is the same
        const { ret: get_ret, data } = await this.storage.get_inscribe_data(
            hash,
        );
        if (get_ret !== 0) {
            console.error(
                `failed to get inscribe data ${inscription_item.inscription_id} ${hash}`,
            );
            return { ret: get_ret };
        }

        if (data == null) {
            console.warn(
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
        const {
            ret: calc_ret,
            weight: hash_weight,
            point: hash_point,
        } = await this.hash_helper.query_hash_weight(
            inscription_item.timestamp,
            hash,
        );
        if (calc_ret !== 0) {
            console.error(
                `failed to calc hash weight ${inscription_item.inscription_id} ${hash}`,
            );
            return { ret: calc_ret };
        }

        assert(_.isString(hash_weight), `invalid hash weight ${hash_weight}`);
        assert(_.isNumber(hash_point), `invalid hash point ${hash_point}`);

        inscription_item.hash_point = hash_point;
        inscription_item.hash_weight = hash_weight;

        // check and try fix price
        const max_price = BigNumberUtil.multiply(hash_weight, 2);
        if (BigNumberUtil.compare(price, max_price) > 0) {
            console.warn(
                `price is too large ${inscription_item.inscription_id} ${price} > ${hash_weight} * 2`,
            );
            content.origin_price = price;
            price = max_price;
        }

        // 3. set price for hash
        const { ret: set_ret } = await this.storage.set_inscribe_data_price(
            hash,
            price,
        );
        if (set_ret !== 0) {
            console.error(
                `failed to set price ${inscription_item.inscription_id} ${hash} ${price}`,
            );
            return { ret: set_ret };
        }

        console.log(
            `set price ${inscription_item.inscription_id} ${hash} ${price}`,
        );

        return { ret: 0, state: InscriptionOpState.OK };
    }
}

module.exports = { SetPriceOperator };
