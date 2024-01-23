const assert = require('assert');
const { Util, BigNumberUtil } = require('../../util');
const { TokenIndexStorage } = require('../../storage/token');
const { HashHelper } = require('./hash');
const { InscriptionOpState } = require('./state');
const {
    InscriptionNewItem,
} = require('../../index/item');
const {
    UserHashRelationStorage,
    UserHashRelation,
} = require('../../storage/relation');
const { ResonanceVerifier } = require('../resonance_verifier');

class PendingResonanceOp {
    constructor(inscription_item, content, hash, hash_distance, state) {
        assert(_.isObject(inscription_item), `invalid item`);
        assert(_.isObject(content), `content should be string`);

        assert(_.isString(hash), `hash should be string`);
        if (state === InscriptionOpState.OK) {
            assert(_.isNumber(hash_distance), `hash_distance should be number`);
        }

        assert(_.isNumber(state), `state should be number`);

        this.inscription_item = inscription_item;
        this.content = content;

        this.hash = hash;
        this.hash_distance = hash_distance;
        this.state = state;
    }
}

class ResonanceOperator {
    constructor(config, storage, hash_helper, relation_storage, resonance_verifier) {
        assert(_.isObject(config), `config should be object`);
        assert(
            storage instanceof TokenIndexStorage,
            `storage should be TokenIndex`,
        );
        assert(
            hash_helper instanceof HashHelper,
            `hash_helper should be HashHelper`,
        );
        assert(
            relation_storage instanceof UserHashRelationStorage,
            `relation_storage should be UserHashRelationStorage`,
        );
        assert(resonance_verifier instanceof ResonanceVerifier, `resonance_verifier should be ResonanceVerifier`);

        this.config = config;
        this.storage = storage;
        this.balance_storage = storage.get_balance_storage();
        this.hash_helper = hash_helper;
        this.relation_storage = relation_storage;
        this.resonance_verifier = resonance_verifier;

        // pending resonance ops that need to be processed, has some restrictions in the same block
        this.pending_resonance_ops = [];
    }

    /**
     * @comment processed on the resonance inscription is inscribed
     * @param {InscriptionNewItem} inscription_item
     * @returns {Promise<{ret: number}>}
     */
    async on_resonance(inscription_item) {
        assert(inscription_item instanceof InscriptionNewItem, `invalid item`);
        assert(_.isObject(inscription_item.content), `invalid content`);

        const { ret, state, hash_distance } = await this._pre_process_resonance(
            inscription_item,
            inscription_item.content,
        );
        if (ret !== 0) {
            return { ret };
        }

        // add to pending list for further process
        const hash = inscription_item.content.ph;
        this.pending_resonance_ops.push(
            new PendingResonanceOp(
                inscription_item,
                inscription_item.content,
                hash,
                hash_distance,
                state,
            ),
        );

        return { ret: 0 };
    }

    /**
     *
     * @returns {Promise<{ret: number}>}
     */
    async process_pending_resonance_ops() {
        // process all pending ops with state is OK
        for (let i = 0; i < this.pending_resonance_ops.length; ++i) {
            const pending_op = this.pending_resonance_ops[i];
            let owner_bonus = '0';
            let service_charge = '0';

            if (pending_op.state === InscriptionOpState.OK) {
                const {
                    ret,
                    owner_bonus: owner_bonus1,
                    service_charge: service_charge1,
                } = await this._resonance(
                    pending_op.inscription_item,
                    pending_op.content,
                    pending_op.state,
                );
                if (ret !== 0) {
                    return { ret };
                }

                assert(
                    _.isString(owner_bonus1),
                    `owner_bonus should be string`,
                );
                assert(
                    _.isString(service_charge1),
                    `service_charge should be string`,
                );

                owner_bonus = owner_bonus1;
                service_charge = service_charge1;
            }

            const inscription_item = pending_op.inscription_item;

            // record the resonance op for any state
            const { ret: add_resonance_op_ret } =
                await this.storage.add_resonance_record(
                    inscription_item.inscription_id,

                    inscription_item.block_height,
                    inscription_item.timestamp,
                    inscription_item.txid,
                    inscription_item.address,
                    inscription_item.hash,
                    JSON.stringify(inscription_item.content),

                    owner_bonus,
                    service_charge,

                    pending_op.state,
                );
            if (add_resonance_op_ret !== 0) {
                console.error(
                    `add_resonance_record failed ${inscription_item.inscription_id}`,
                );
                return { ret: add_resonance_op_ret };
            }
        }

        return { ret: 0 };
    }

    async _pre_process_resonance(inscription_item, content) {
        assert(content instanceof Object, `content should be object`);

        inscription_item.hash = '';
        inscription_item.amt = '0';
        
        // first check if hash and amt field is exists
        const hash = content.ph;
        if (hash == null || !_.isString(hash)) {
            console.warn(
                `invalid inscription ph ${inscription_item.inscription_id} ${hash}`,
            );

            // invalid format, so we should ignore this inscription
            return { ret: 0, state: InscriptionOpState.INVALID_PARAMS };
        }
        inscription_item.hash = hash;

        const amt = content.amt;
        if (!BigNumberUtil.is_positive_number_string(amt)) {
            console.error(
                `invalid inscription amt ${inscription_item.inscription_id} ${amt}`,
            );
            return { ret: 0, state: InscriptionOpState.INVALID_PARAMS };
        }
        inscription_item.amt = amt;

        // at first we should verify the hash's resonance count, check if any user has no chant at 12800 consecutive blocks
        const { ret: verify_ret } = await this.resonance_verifier.verify_hash(hash, inscription_item.block_height);
        if (verify_ret !== 0) {
            console.error(`verify hash resonance failed ${hash}`);
            return { ret: verify_ret };
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

        // 2. check the relation if already exists
        const { ret: get_relation_ret, data: relation } =
            await this.relation_storage.get_user_hash_relation(
                inscription_item.address,
                hash,
            );
        if (get_relation_ret !== 0) {
            console.error(
                `get_user_hash_relation failed ${inscription_item.address} ${hash}`,
            );
            return { ret: get_relation_ret };
        }
        if (relation != null) {
            if (relation.relation === UserHashRelation.Resonance) {
                // user can only resonance once for one hash
                console.warn(
                    `user ${inscription_item.address} has resonance relation with hash ${hash}`,
                );
                return { ret: 0, state: InscriptionOpState.ALREADY_EXISTS };
            } else if (relation.relation === UserHashRelation.Owner) {
                // user can not resonance for its own hash
                console.warn(
                    `user ${inscription_item.address} has owner relation with hash ${hash}`,
                );
                return { ret: 0, state: InscriptionOpState.PERMISSION_DENIED };
            } else {
                // should not happen
                console.error(
                    `user ${inscription_item.address} has relation with hash ${hash}: ${relation.relation}`,
                );
                return { ret: -1 };
            }
        }

        // 2. check the price of the hash, a hash can be resonated only if the price is greater than zero
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
        const { ret: get_balance_ret, amount: balance } =
            await this.balance_storage.get_inner_balance(inscription_item.address);
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

        // 5. check if output address is the hash's address
        if (inscription_item.owner_address !== data.address) {
            console.warn(
                `target address ${inscription_item.owner_address} is not the hash ${hash} owner ${data.address}, ${inscription_item.inscription_id}`,
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

    /**
     *
     * @param {object} inscription_item
     * @param {object} content
     * @param {number} state
     * @returns {Promise<{ret: number, owner_bonus: string, service_charge: string}>}
     */
    async _resonance(inscription_item, content, state) {
        assert(_.isNumber(state), `state should be number`);

        // 1. first transfer balance for bonus and service charge
        const amt = content.amt;
        assert(
            BigNumberUtil.is_positive_number_string(amt),
            `invalid amt ${amt}`,
        );

        const service_charge = BigNumberUtil.multiply(amt, 0.2); // amt * 0.2;
        const owner_bonus = BigNumberUtil.subtract(amt, service_charge); // amt - service_charge;

        if (BigNumberUtil.compare(service_charge, 0) > 0) {
            const { ret } = await this.balance_storage.transfer_inner_balance(
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
            BigNumberUtil.compare(owner_bonus, 0) > 0 &&
            inscription_item.address !== inscription_item.output_address
        ) {
            const { ret } = await this.balance_storage.transfer_inner_balance(
                inscription_item.address,
                inscription_item.output_address,
                owner_bonus,
            );
            if (ret !== 0) {
                console.error(
                    `transfer_balance for owner bonus failed ${inscription_item.address} ${inscription_item.output_address} ${owner_bonus}`,
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

        // 3. build the relation between user and hash for the first time
        const { ret: update_relation_ret } =
            await this.relation_storage.insert_relation(
                inscription_item.address,
                hash,
                inscription_item.inscription_id,
                inscription_item.block_height,
                inscription_item.timestamp,
                UserHashRelation.Resonance,
            );
        if (update_relation_ret !== 0) {
            console.error(
                `insert relation failed ${inscription_item.inscription_id} ${inscription_item.address} ${hash}`,
            );
            return { ret: update_relation_ret };
        }

        console.log(
            `resonance success ${inscription_item.inscription_id} ${inscription_item.address} -> ${inscription_item.output_address} ${inscription_item.content.ph} ${inscription_item.content.amt}`,
        );

        return { ret: 0, owner_bonus, service_charge };
    }
}

module.exports = { ResonanceOperator };
