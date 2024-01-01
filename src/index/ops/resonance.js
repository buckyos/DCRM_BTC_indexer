const assert = require('assert');
const { Util, BigNumberUtil } = require('../../util');
const { TokenIndex, TokenIndexStorage } = require('../../storage/token');
const { HashHelper } = require('./hash');
const { InscriptionOpState } = require('./state');
const { InscriptionTransferItem, InscriptionNewItem } = require('../item');

class PendingResonanceOp {
    constructor(inscription_item, content, hash, hash_distance, state) {
        assert(_.isObject(inscription_item), `invalid item`);
        assert(_.isObject(content), `content should be string`);

        assert(_.isString(hash), `hash should be string`);
        assert(_.isNumber(hash_distance), `hash_distance should be number`);
        assert(_.isNumber(state), `state should be number`);

        this.inscription_item = inscription_item;
        this.content = content;

        this.hash = hash;
        this.hash_distance = hash_distance;
        this.state = state;
    }
}

class ResonanceOperator {
    constructor(config, storage, hash_helper) {
        assert(_.isObject(config), `config should be object`);
        assert(
            storage instanceof TokenIndexStorage,
            `storage should be TokenIndex`,
        );
        assert(
            hash_helper instanceof HashHelper,
            `hash_helper should be HashHelper`,
        );

        this.config = config;
        this.storage = storage;
        this.hash_helper = hash_helper;

        // pending resonance ops that need to be processed, has some rescirptions in the same block
        this.pending_resonance_ops = [];
    }

    /**
     * @comment processed on the resonance inscription is inscribed
     * @param {InscriptionNewItem} inscription_item
     * @returns {Promise<{ret: number}>}
     */
    async on_inscribe(inscription_item) {
        assert(inscription_item instanceof InscriptionNewItem, `invalid item`);

        const hash = inscription_item.content.ph;
        assert(_.isString(hash), `hash should be string`);

        const { ret } = await this.storage.add_resonance_record_on_inscribed(
            inscription_item.inscription_id,

            inscription_item.block_height,
            inscription_item.timestamp,
            inscription_item.txid,
            inscription_item.address,

            hash,
            JSON.stringify(inscription_item.content),
            InscriptionOpState.OK,
        );
        if (ret !== 0) {
            console.error(
                `failed to record resonance on inscribed ${inscription_item.inscription_id} ${inscription_item.address}`,
            );
            return { ret };
        }

        console.log(
            `record resonance inscribe ${inscription_item.inscription_id} ${
                inscription_item.address
            } ${JSON.stringify(inscription_item.content)}`,
        );

        return { ret: 0 };
    }
    /**
     *
     * @param {InscriptionTransferItem} inscription_transfer_item
     * @returns {Promise<{ret: number}>}
     */
    async on_transfer(inscription_transfer_item) {
        assert(
            inscription_transfer_item instanceof InscriptionTransferItem,
            `invalid item`,
        );

        assert(
            inscription_transfer_item.index > 0,
            `invalid resonance transfer index ${inscription_transfer_item.inscription_id}`,
        );

        // only process on first transfer
        if (inscription_transfer_item.index > 1) {
            console.log(
                `ignore resonance transfer ${inscription_transfer_item.inscription_id} ${inscription_transfer_item.from_address} -> ${inscription_transfer_item.to_address}, ${inscription_transfer_item.index}`,
            );
            return { ret: 0 };
        }

        // first query the inscription at the inscribed stage
        const { ret: get_inscribed_ret, date: inscription_item } =
            await this.storage.query_resonance_record(
                inscription_transfer_item.inscription_id,
                InscriptionStage.Inscribe,
            );
        if (get_inscribed_ret !== 0) {
            console.error(
                `failed to query resonance record ${inscription_transfer_item.inscription_id}`,
            );
            return { ret: get_inscribed_ret };
        }

        if (inscription_item == null) {
            console.error(
                `query resonance isncribe record but not found: ${inscription_transfer_item.inscription_id}`,
            );
            return { ret: 0 };
        }

        assert(
            inscription_item.inscription_id ===
                inscription_transfer_item.inscription_id,
            `inscription_id should be the same: ${inscription_item.inscription_id} !== ${inscription_transfer_item.inscription_id}`,
        );
        assert(
            inscription_item.address === inscription_transfer_item.from_address,
            `inscription creator address should be the same: ${inscription_item.address} !== ${inscription_transfer_item.from_address}`,
        );

        // parse content in JSON format
        const content = JSON.parse(inscription_item.content);
        assert(content.amt != null, `amt should be set`);
        assert(content.ph != null, `ph should be set`);
        assert(
            content.ph === inscription_item.hash,
            `ph should be the same: ${content.ph} !== ${inscription_item.hash}`,
        );

        // init some transfer fields from inscription item
        inscription_item.block_height = inscription_transfer_item.block_height;
        inscription_item.timestamp = inscription_transfer_item.timestamp;
        inscription_item.txid = inscription_transfer_item.txid;
        inscription_item.owner_address = inscription_transfer_item.to_address;

        // then do resonance
        const { ret, state, hash_distance } = await this._pre_process_resonance(
            inscription_item,
            content,
        );
        if (ret !== 0) {
            return { ret };
        }

        // add to pending list for further process
        const hash = content.ph;
        this.pending_resonance_ops.push(
            new PendingResonanceOp(
                inscription_item,
                content,
                hash,
                hash_distance,
                state,
            ),
        );

        return { ret: 0 };
    }

    async process_pending_resonance_ops() {
        // process all pending ops with state is OK
        for (let i = 0; i < this.pending_resonance_ops.length; ++i) {
            const pending_op = this.pending_resonance_ops[i];
            if (pending_op.state !== InscriptionOpState.OK) {
                continue;
            }

            const { ret } = await this._resonance(
                pending_op.inscription_item,
                pending_op.content,
                pending_op.state,
            );
            if (ret !== 0) {
                return { ret };
            }
        }

        return { ret: 0 };
    }

    async _pre_process_resonance(inscription_item, content) {
        assert(content instanceof Object, `content should be object`);

        // first check if hash and amt field is exists
        const hash = content.ph;
        if (hash == null || !_.isString(hash)) {
            console.warn(
                `invalid inscription ph ${inscription_item.inscription_id} ${hash}`,
            );

            // invalid format, so we should ignore this inscription
            return { ret: 0, state: InscriptionOpState.INVALID_PARAMS };
        }

        const amt = content.amt;
        if (!BigNumberUtil.is_positive_number_string(amt)) {
            console.error(
                `invalid inscription amt ${inscription_item.inscription_id} ${amt}`,
            );
            return { ret: 0, state: InscriptionOpState.INVALID_PARAMS };
        }

        // 1. check if the hash had been inscribed
        const { ret: get_inscribe_data_ret, data } =
            await this.storage.get_inscribe_data(hash);
        if (get_inscribe_data_ret !== 0) {
            console.error(`get_inscribe_data failed ${hash}`);
            return { ret: get_inscribe_data_ret };
        }

        if (data == null) {
            console.warn(`hash ${hash} has not been inscribed`);
            return { ret: 0, state: InscriptionOpState.HASH_NOT_FOUND };
        }

        // 2. check the price of the hash, a hash can be resnoanced only if the price is greater than zero
        const price = data.price;
        if (price == null || BigNumberUtil.compare(price, 0) <= 0) {
            console.warn(`hash ${hash} price is zero or not set yet`);
            return { ret: 0, state: InscriptionOpState.INVALID_PRICE };
        }

        // 3. check if the amt is enough
        if (BigNumberUtil.compare(amt, price) < 0) {
            console.warn(
                `amt ${amt} is not enough for hash ${hash} price ${price} ${inscription_item.inscription_id}`,
            );
            return { ret: 0, state: InscriptionOpState.INVALID_AMT };
        }

        // 4. check user's balance
        const { ret: get_balance_ret, balance } =
            await this.storage.get_balance(inscription_item.address);
        if (get_balance_ret !== 0) {
            console.error(`get_balance failed ${inscription_item.address}`);
            return { ret: get_balance_ret };
        }
        
        assert(_.isString(balance), `balance should be string ${balance}`);
        if (BigNumberUtil.compare(balance, amt) < 0) {
            console.warn(
                `user ${inscription_item.address} balance ${balance} is not enough for amt ${amt} ${inscription_item.inscription_id}`,
            );
            return { ret: 0, state: InscriptionOpState.INSUFFICIENT_BALANCE };
        }

        // 5. check if output address is the hash's owner
        if (inscription_item.owner_address !== data.owner) {
            console.warn(
                `output address ${inscription_item.owner_address} is not the hash ${hash} owner ${data.owner}, ${inscription_item.inscription_id}`,
            );
            return {
                ret: 0,
                state: InscriptionOpState.OUT_ADDRESS_IS_NOT_OWNER,
            };
        }

        // 6. check resonance count of the hash, max is 15
        assert(
            _.isNumber(data.resonance_count),
            `resonance_count should be number`,
        );
        if (data.resonance_count >= 15) {
            console.warn(
                `hash ${hash} resonance_count ${data.resonance_count} is greater than 15`,
            );
            return { ret: 0, state: InscriptionOpState.OUT_OF_RESONANCE_LIMIT };
        }

        // 7. If the use has not any chant 12,800 consecutive blocks, will loses its resonance right
        const { ret: get_last_chant_ret, data: last_chant_data } =
            await this.storage.get_user_last_chant(inscription_item.address);
        if (get_last_chant_ret !== 0) {
            console.error(
                `get_user_last_chant failed ${inscription_item.address}`,
            );
            return { ret: get_last_chant_ret };
        }

        if (last_chant_data != null) {
            if (
                last_chant_data.block_height + 12800 <
                inscription_item.block_height
            ) {
                console.warn(
                    `user ${inscription_item.address} has no chant at 12800 consecutive blocks, last chant block number ${last_chant_data.block_height}, current block number ${inscription_item.block_height}`,
                );
                return { ret: 0, state: InscriptionOpState.HAS_NO_VALID_CHANT };
            }
        } else {
            // user has no chant at any block
            // TODO: should we check for this case?
        }

        // 8. the op with same hash in current block, only the min distance one can be processed
        const hash_distance = Util.calc_distance_with_hash_and_address(
            hash,
            inscription_item.address,
        );
        for (let i = 0; i < this.pending_resonance_ops.length; ++i) {
            const pending_op = this.pending_resonance_ops[i];
            if (
                pending_op.hash === hash &&
                pending_op.state === InscriptionOpState.OK
            ) {
                if (pending_op.hash_distance <= hash_distance) {
                    console.warn(
                        `hash ${hash} has been processed in current block, current hash distance ${hash_distance} ${inscription_item.inscription_id}, pending hash distance ${pending_op.hash_distance} ${pending_op.inscription_item.inscription_id}`,
                    );

                    return {
                        ret: 0,
                        state: InscriptionOpState.COMPETITION_FAILED,
                    };
                } else {
                    pending_op.state = InscriptionOpState.COMPETITION_FAILED;
                    continue;
                }
            }
        }

        return { ret: 0, state: InscriptionOpState.OK, hash_distance };
    }

    async _resonance(inscription_item, content, state) {
        assert(_.isNumber(state), `state should be number`);

        // 1. first transfer balance for bouns and service charge
        const amt = content.amt;
        assert(BigNumberUtil.is_positive_number_string(amt), `invalid amt ${amt}`);

        const service_charge = BigNumberUtil.multiply(amt, 0.2) // amt * 0.2;
        const owner_bouns = BigNumberUtil.subtract(amt, service_charge); // amt - service_charge;

        if (BigNumberUtil.compare(service_charge, 0) > 0) {
            const { ret } = await this.storage.transfer_balance(
                inscription_item.address,
                this.config.token.account.foundation_address,
                service_charge,
            );
            if (ret !== 0) {
                console.error(
                    `transfer_balance for service charge failed ${inscription_item.address} ${this.config.token.account.foundation_address} ${service_charge}`,
                );
                return { ret };
            }
        }

        if (
            BigNumberUtil.compare(owner_bouns, 0) > 0 &&
            inscription_item.address !== inscription_item.output_address
        ) {
            const { ret } = await this.storage.transfer_balance(
                inscription_item.address,
                inscription_item.output_address,
                owner_bouns,
            );
            if (ret !== 0) {
                console.error(
                    `transfer_balance for owner bouns failed ${inscription_item.address} ${inscription_item.output_address} ${owner_bouns}`,
                );
                return { ret };
            }
        }

        // 2. then update inscription data for resonance count
        const hash = content.ph;
        assert(_.isString(hash), `hash should be string`);

        const { ret: update_inscribe_data_ret } =
            await this.storage.update_resonance_count(hash);
        if (update_inscribe_data_ret !== 0) {
            console.error(`update_resonance_count failed ${hash}`);
            return { ret: update_inscribe_data_ret };
        }

        // 3. record the resnoance op
        const { ret: add_resonance_op_ret } =
            await this.storage.add_resonance_record_on_transfered(
                inscription_item.inscription_id,

                inscription_item.genesis_block_height,
                inscription_item.genesis_timestamp,
                inscription_item.genesis_txid,
                inscription_item.address,
                inscription_item.hash,
                inscription_item.content,

                inscription_item.block_height,
                inscription_item.timestamp,
                inscription_item.txid,
                inscription_item.owner_address,

                owner_bouns,
                service_charge,

                state,
            );
        if (add_resonance_op_ret !== 0) {
            console.error(
                `add_resonance_record failed ${inscription_item.inscription_id}`,
            );
            return { ret: add_resonance_op_ret };
        }

        console.log(
            `resonance success ${inscription_item.inscription_id} ${inscription_item.address} -> ${inscription_item.output_address} ${inscription_item.content.ph} ${inscription_item.content.amt}`,
        );
        return { ret: 0 };
    }
}

module.exports = { ResonanceOperator };
