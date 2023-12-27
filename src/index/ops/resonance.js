const assert = require('assert');
const { Util } = require('../../util');
const { TokenIndex } = require('../../storage/token');
const { HashHelper } = require('./hash');
const { InscriptionOpState } = require('./state');

class PendingResonanceOp {
    constructor(inscription_item, hash, hash_distance) {
        this.inscription_item = inscription_item;
        this.hash = hash;
        this.hash_distance = hash_distance;
    }
}

class ResonanceOperator {
    constructor(config, storage, hash_helper) {
        assert(_.isObject(config), `config should be object`);
        assert(storage instanceof TokenIndex, `storage should be TokenIndex`);
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
     *
     * @param {object} inscription_item
     * @returns {Promise<{ret: number}>}
     */
    async on_resonance(inscription_item) {
        // first do resonance
        const { ret, state, hash_distance } = await this._pre_process_resonance(
            inscription_item,
        );
        if (ret !== 0) {
            return { ret };
        }

        // add to pending list for further process
        const hash = inscription_item.content.ph;
        this.pending_resonance_ops.push(
            new PendingResonanceOp(inscription_item, hash, hash_distance),
        );

        return { ret: 0 };
    }

    async on_transfer_with_resonance(inscription_item) {
        return await this.on_resonance(inscription_item);
    }

    async process_pending_resonance_ops() {
        // process all pending ops with state is OK
        for (let i = 0; i < this.pending_resonance_ops.length; ++i) {
            const pending_op = this.pending_resonance_ops[i];
            if (pending_op.state !== InscriptionOpState.OK) {
                continue;
            }

            const { ret } = await this._resonance(pending_op.inscription_item, pending_op.state);
            if (ret !== 0) {
                return { ret };
            }
        }

        return { ret: 0 };
    }

    async _pre_process_resonance(inscription_item) {
        // first check if hash and amt field is exists
        const hash = inscription_item.content.ph;
        if (hash == null || !_.isString(hash)) {
            console.warn(
                `invalid inscription ph ${inscription_item.inscription_id} ${hash}`,
            );

            // invalid format, so we should ignore this inscription
            return { ret: 0, state: InscriptionOpState.INVALID_PARAMS };
        }

        const amt = inscription_item.content.amt;
        if (amt == null || !_.isNumber(amt)) {
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
        if (price <= 0) {
            console.warn(`hash ${hash} price is zero`);
            return { ret: 0, state: InscriptionOpState.INVALID_PRICE };
        }

        // 3. check if the amt is enough
        if (amt < price) {
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

        if (balance < amt) {
            console.warn(
                `user ${inscription_item.address} balance ${balance} is not enough for amt ${amt} ${inscription_item.inscription_id}`,
            );
            return { ret: 0, state: InscriptionOpState.INSUFFICIENT_BALANCE };
        }

        // 5. check if output address is the hash's owner
        if (inscription_item.output_address !== data.owner) {
            console.warn(
                `output address ${inscription_item.output_address} is not the hash ${hash} owner ${data.owner}, ${inscription_item.inscription_id}`,
            );
            return {
                ret: 0,
                state: InscriptionOpState.OUT_ADDRESS_IS_NOT_OWNER,
            };
        }

        // 6. check resnoance count of the hash, max is 15
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

    async _resonance(inscription_item, state) {
        assert(_.isNumber(state), `state should be number`);

        // 1. first transfer balance for bouns and service charge
        const amt = inscription_item.content.amt;
        assert(_.isNumber(amt), `amt should be number`);

        const service_charge = Math.floor(amt * 0.2);
        const owner_bouns = amt - service_charge;

        if (service_charge > 0) {
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
            owner_bouns > 0 &&
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
        const hash = inscription_item.content.ph;
        const { ret: update_inscribe_data_ret } =
            await this.storage.update_resonance_count(hash);
        if (update_inscribe_data_ret !== 0) {
            console.error(`update_resonance_count failed ${hash}`);
            return { ret: update_inscribe_data_ret };
        }

        // 3. record the resnoance op
        const { ret: add_resonance_op_ret } =
            await this.storage.add_resonance_record(
                inscription_item.inscription_id,
                inscription_item.block_height,
                inscription_item.timestamp,
                hash,
                inscription_item.address,
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
