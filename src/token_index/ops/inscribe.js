const assert = require('assert');
const { Util, BigNumberUtil } = require('../../util');
const {
    TokenIndexStorage,
    UpdatePoolBalanceOp,
} = require('../../storage/token');
const { HashHelper } = require('./hash');
const { InscriptionOpState } = require('./state');
const {
    InscriptionNewItem,
    InscriptionTransferItem,
} = require('../../index/item');
const { DIFFICULTY_INSCRIBE_DATA_HASH_THRESHOLD } = require('../../constants');
const {
    UserHashRelationStorage,
    UserHashRelation,
} = require('../../storage/relation');

class PendingInscribeOp {
    constructor(inscription_item, state, hash_distance) {
        this.inscription_item = inscription_item;
        this.state = state;
        this.hash_distance = hash_distance;
    }
}

class InscribeDataOperator {
    constructor(config, storage, hash_helper, relation_storage) {
        assert(config, `config should not be null`);
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

        this.config = config;
        this.storage = storage;
        this.balance_storage = storage.get_balance_storage();
        this.hash_helper = hash_helper;
        this.relation_storage = relation_storage;

        // load difficulty of inscribe data hash threshold from config
        this.inscribe_data_hash_threshold =
            DIFFICULTY_INSCRIBE_DATA_HASH_THRESHOLD;
        if (config.token.difficulty.inscribe_data_hash_threshold != null) {
            this.inscribe_data_hash_threshold =
                config.token.difficulty.inscribe_data_hash_threshold;
            assert(_.isNumber(this.inscribe_data_hash_threshold));
        }

        // pending operations that with some restrictions in the same block
        this.pending_inscribe_ops = [];
    }

    /**
     * @comment processed on the inscription transferred
     * @param {InscriptionTransferItem} inscription_transfer_item
     * @returns {Promise<{ret: number}>}
     */
    async on_transfer(inscription_transfer_item) {
        const { ret, state } = await this._on_transfer(
            inscription_transfer_item,
        );
        if (ret !== 0) {
            return { ret };
        }

        assert(_.isNumber(state), `invalid state ${state}`);
        assert(_.isString(inscription_transfer_item.hash), `invalid hash`);

        // save the record
        const { ret: add_record_ret } =
            await this.storage.add_inscribe_data_transfer_record(
                inscription_transfer_item.inscription_id,
                inscription_transfer_item.hash,
                inscription_transfer_item.block_height,
                inscription_transfer_item.timestamp,
                inscription_transfer_item.txid,
                inscription_transfer_item.satpoint.to_string(),
                inscription_transfer_item.from_address,
                inscription_transfer_item.to_address,
                inscription_transfer_item.value,
                state,
            );
        if (add_record_ret !== 0) {
            console.error(
                `failed to record user transfer data op ${inscription_transfer_item.inscription_id} ${inscription_transfer_item.hash}`,
            );
            return { ret: add_record_ret };
        }

        return { ret: 0 };
    }

    /**
     * @comment processed on the inscription transferred
     * @param {InscriptionTransferItem} inscription_transfer_item
     * @returns {Promise<{ret: number, state: number}>}
     */
    async _on_transfer(inscription_transfer_item) {
        assert(
            inscription_transfer_item instanceof InscriptionTransferItem,
            `invalid inscribe data transfer item`,
        );

        assert(
            inscription_transfer_item.index > 0,
            `invalid transfer index ${inscription_transfer_item.inscription_id} ${inscription_transfer_item.index}`,
        );

        // 1. first query the inscribe data record
        const { ret: get_inscribe_record_ret, data: record } =
            await this.storage.query_inscribe_data_record(
                inscription_transfer_item.inscription_id,
            );
        if (get_inscribe_record_ret !== 0) {
            console.error(
                `failed to get inscribe record ${inscription_transfer_item.inscription_id}`,
            );
            return { ret: get_inscribe_record_ret };
        }

        if (record == null) {
            // FIXME should not reach here
            console.error(
                `inscribe record not exists ${inscription_transfer_item.inscription_id}`,
            );
            return { ret: 0, state: InscriptionOpState.RECORD_NOT_FOUND };
        }

        assert(
            _.isString(record.hash),
            `invalid inscribe record hash ${inscription_transfer_item.inscription_id}`,
        );
        const hash = record.hash;
        inscription_transfer_item.hash = hash;

        // 2. then query current inscribed data
        const { ret: get_inscribe_data_ret, data } =
            await this.storage.get_inscribe_data(hash);
        if (get_inscribe_data_ret !== 0) {
            console.error(
                `failed to get inscribe data ${inscription_transfer_item.inscription_id} ${hash}`,
            );
            return { ret: get_inscribe_data_ret };
        }

        if (data == null) {
            // the inscribe must be failed! so we cant find the inscribe data
            console.warn(
                `inscribe data not exists ${inscription_transfer_item.inscription_id} ${hash}`,
            );
            return { ret: 0, state: InscriptionOpState.HASH_NOT_FOUND };
        }

        // 3. check if the block_height is greater than the current block_height
        assert(
            _.isNumber(data.block_height),
            `invalid inscribe data block_height ${inscription_transfer_item.inscription_id} ${hash}`,
        );
        if (inscription_transfer_item.block_height < data.block_height) {
            console.error(
                `invalid inscribe data block_height ${inscription_transfer_item.inscription_id} ${hash} ${inscription_transfer_item.block_height} < ${data.block_height}`,
            );
            return { ret: 0, state: InscriptionOpState.INVALID_STATE };
        }

        // 4. update owner with transfer_inscribe_data_owner
        const { ret: update_owner_ret } =
            await this.storage.transfer_inscribe_data_owner(
                hash,
                data.block_height,
                inscription_transfer_item.to_address,
                inscription_transfer_item.block_height,
                inscription_transfer_item.timestamp,
            );
        if (update_owner_ret !== 0) {
            if (update_owner_ret > 0) {
                // FIXME should not reach here?
                console.error(
                    `transfer inscribe data owner but not matched ${inscription_transfer_item.inscription_id} ${hash}`,
                );
                return { ret: 0, state: InscriptionOpState.INVALID_STATE };
            } else {
                console.error(
                    `failed to update inscribe data owner ${inscription_transfer_item.inscription_id} ${hash}`,
                );
                return { ret: update_owner_ret };
            }
        }

        // 5. update relation and transfer inscribe data owner
        const { ret: update_relation_ret } =
            await this.relation_storage.transfer_owner(
                inscription_transfer_item.from_address,
                inscription_transfer_item.to_address,
                hash,
            );
        if (update_relation_ret !== 0) {
            console.error(
                `failed to update owner relation ${inscription_transfer_item.from_address} -> ${inscription_transfer_item.to_address} hash: ${inscription_transfer_item.inscription_id} ${hash}`,
            );
            return { ret: update_relation_ret };
        }

        console.log(
            `transfer inscribe data owner ${inscription_transfer_item.inscription_id} ${hash} ${data.address} -> ${inscription_transfer_item.to_address}`,
        );

        return { ret: 0, state: InscriptionOpState.OK };
    }

    /**
     *
     * @param {InscriptionNewItem} inscription_item
     * @returns {Promise<{ret: number}>}
     */
    async on_inscribe(inscription_item) {
        const {
            ret: pre_inscribe_ret,
            state,
            distance,
        } = await this._on_pre_inscribe(inscription_item);
        if (pre_inscribe_ret !== 0) {
            console.error(
                `failed to pre inscribe ${inscription_item.inscription_id}`,
            );
            return { ret: pre_inscribe_ret };
        }

        assert(_.isNumber(state), `invalid state ${state}`);
        if (state === InscriptionOpState.OK) {
            assert(_.isNumber(distance), `invalid distance ${distance}`);
        }

        // add to pending inscribe ops for later process
        const op = new PendingInscribeOp(inscription_item, state, distance);
        this.pending_inscribe_ops.push(op);

        return { ret: 0 };
    }

    /**
     *
     * @param {InscriptionNewItem} inscription_item
     * @returns {Promise<{ret: number, state: number, distance: number}>}
     */
    async _on_pre_inscribe(inscription_item) {
        assert(
            inscription_item instanceof InscriptionNewItem,
            `invalid inscription_item`,
        );

        // set to default value on start
        inscription_item.hash_point = 0;
        inscription_item.hash_weight = '0';
        inscription_item.price = '0';
        inscription_item.hash = '';
        inscription_item.text = null;
        inscription_item.amt = '0';

        // first check if params is valid
        
        // check hash is string and valid mixhash
        const hash = inscription_item.content.ph;
        if (hash == null || !_.isString(hash)) {
            console.warn(
                `invalid inscription ph ${inscription_item.inscription_id} ${hash}`,
            );

            // invalid format, so we should ignore this inscription
            return { ret: 0, state: InscriptionOpState.INVALID_PARAMS };
        }

        if (!Util.is_valid_mixhash(hash)) {
            console.warn(`invalid inscribe content ph ${hash}, ${inscription_item.inscription_id}`);
            return { ret: 0, state: InscriptionOpState.INVALID_PARAMS };
        }
        inscription_item.hash = hash;

        // check amt is exists and valid
        const amt = inscription_item.content.amt;
        if (amt == null || !BigNumberUtil.is_positive_number_string(amt)) {
            console.warn(
                `invalid inscription amt ${inscription_item.inscription_id} ${amt}`,
            );
            return { ret: 0, state: InscriptionOpState.INVALID_PARAMS };
        }
        inscription_item.amt = amt;

        // check text is valid if exists
        const text = inscription_item.content.text;
        if (text != null && !_.isString(text)) {
            console.warn(
                `invalid inscription text ${inscription_item.inscription_id} ${text}`,
            );
            return { ret: 0, state: InscriptionOpState.INVALID_PARAMS };
        }
        inscription_item.text = text;

        // check price is valid if exists
        const price = inscription_item.content.price;
        if (price != null) {
            if (!BigNumberUtil.is_positive_number_string(price)) {
                console.warn(`invalid inscribe content price ${price}`);
                return { ret: 0, state: InscriptionOpState.INVALID_PARAMS };
            }
            inscription_item.price = price;
        } else {
            // set to default value
            inscription_item.price = '0';
        }

        // 1. check if hash already been inscribed
        const { ret: get_inscribe_data_ret, data } =
            await this.storage.get_inscribe_data(hash);
        if (get_inscribe_data_ret !== 0) {
            console.error(
                `failed to get inscribe data ${inscription_item.inscription_id} ${hash}`,
            );
            return { ret: get_inscribe_data_ret };
        }

        if (data != null) {
            console.warn(
                `hash already been inscribed ${inscription_item.inscription_id} ${hash}`,
            );

            // hash already been inscribed, so this inscription will failed
            return { ret: 0, state: InscriptionOpState.ALREADY_EXISTS };
        }

        // 2. check hash condition if satisfied with user's address
        if (
            !Util.check_inscribe_hash_and_address(
                hash,
                inscription_item.address,
                this.inscribe_data_hash_threshold,
            )
        ) {
            // not match (hash - commit_txid) % hash_th != 0, so this inscription will failed

            console.info(
                `data hash and last txid not match ${inscription_item.inscription_id} ${hash} ${inscription_item.last_txid}`,
            );

            return { ret: 0, state: InscriptionOpState.HASH_UNMATCHED };
        }

        // 3. check weight with amt, amt must be greater than hash weight
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

        inscription_item.hash_weight = hash_weight;
        inscription_item.hash_point = hash_point;

        // suppose that: n = (hash_weight * 2), then we should confirm that:
        // amt >= n
        // price <= n
        const max_price = BigNumberUtil.multiply(hash_weight, 2);

        // 4. try fix price if exists
        if (inscription_item.price != null && inscription_item.price !== '0') {
            const price = inscription_item.price;
            assert(
                BigNumberUtil.is_positive_number_string(price),
                `invalid price ${price}`,
            );

            // check and try fix price
            if (BigNumberUtil.compare(price, max_price) > 0) {
                console.warn(
                    `price is too large ${inscription_item.inscription_id} ${price} > ${hash_weight} * 2`,
                );

                
                inscription_item.price = max_price;
            }
        }

        // 5. check if hash weight is less than amt (amt >= hash_weight * 2)
        if (BigNumberUtil.compare(amt, max_price) < 0) {
            console.warn(
                `hash weight is less than amt ${inscription_item.inscription_id} ${amt} < ${max_price}`,
            );

            // hash weight is less than amt, so this inscription will failed

            return { ret: 0, state: InscriptionOpState.INVALID_AMT };
        }

        // 6. check if address balance is enough
        const { ret: get_balance_ret, amount: balance } =
            await this.balance_storage.get_inner_balance(inscription_item.address);
        if (get_balance_ret !== 0) {
            console.error(
                `failed to get balance ${inscription_item.inscription_id} ${inscription_item.address}`,
            );
            return { ret: get_balance_ret };
        }

        assert(_.isString(balance), `invalid balance ${balance}`);
        if (BigNumberUtil.compare(balance, amt) < 0) {
            console.warn(
                `inner token balance is not enough ${inscription_item.inscription_id} ${inscription_item.address} ${balance} < ${amt}`,
            );

            // inner token balance is not enough, so this inscription will failed
            return { ret: 0, state: InscriptionOpState.INSUFFICIENT_BALANCE };
        }

        // 7. calc distance of (address, hash)
        // if there is multiple inscribe in the same block, we should select the one had the shortest distance
        const distance = Util.calc_distance_with_hash_and_address(
            hash,
            inscription_item.address,
        );

        let state = InscriptionOpState.OK;

        // 8. check if there is any pending inscribe op in the same block with same hash
        for (const op of this.pending_inscribe_ops) {
            if (
                op.state === InscriptionOpState.OK &&
                op.inscription_item.content.ph === hash
            ) {
                assert(
                    _.isNumber(op.hash_distance),
                    `invalid hash distance ${op.hash_distance}`,
                );
                if (op.hash_distance <= distance) {
                    // competition failed
                    console.warn(
                        `competition failed in same block! new: ${inscription_item.inscription_id} old: ${op.inscription_item.inscription_id}, new ${distance} > old ${op.hash_distance}`,
                    );
                    state = InscriptionOpState.COMPETITION_FAILED;
                    break;
                } else {
                    console.warn(
                        `competition failed in same block! new: ${inscription_item.inscription_id} old: ${op.inscription_item.inscription_id}, old ${op.hash_distance} > new ${distance}`,
                    );
                    op.state = InscriptionOpState.COMPETITION_FAILED;
                }
            }
        }

        return { ret: 0, state, distance };
    }

    async process_pending_inscribe_ops() {
        for (const op of this.pending_inscribe_ops) {
            let mint_amt = '0';
            let service_charge = '0';

            if (
                op.state === InscriptionOpState.OK ||
                op.state === InscriptionOpState.COMPETITION_FAILED
            ) {
                const {
                    ret,
                    mint_amt: mint_amt1,
                    service_charge: service_charge1,
                } = await this._inscribe(op);
                if (ret !== 0) {
                    console.error(
                        `failed to process pending inscribe data op ${op.inscription_item.inscription_id}`,
                    );
                    return { ret };
                }

                assert(_.isString(mint_amt1), `invalid mint_amt ${mint_amt1}`);
                assert(
                    _.isString(service_charge1),
                    `invalid service_charge ${service_charge1}`,
                );

                mint_amt = mint_amt1;
                service_charge = service_charge1;
            }

            // record inscribe data record for any state
            const { ret: record_ret } =
                await this.storage.add_inscribe_data_record(
                    op.inscription_item.inscription_id,
                    op.inscription_item.block_height,
                    op.inscription_item.address,
                    op.inscription_item.timestamp,
                    op.inscription_item.txid,
                    op.inscription_item.hash, // use inscription_item.hash instead of inscription_item.content.ph for param check
                    JSON.stringify(op.inscription_item.content),
                    mint_amt,
                    service_charge,
                    op.inscription_item.text,
                    op.inscription_item.price,  // use price field in inscription_item instead of inscription_item.content.price
                    op.inscription_item.hash_point,
                    op.inscription_item.hash_weight,
                    op.state,
                );
            if (record_ret !== 0) {
                console.error(
                    `failed to record inscribe data op ${op.inscription_item.inscription_id}`,
                );
                return { ret: record_ret };
            }
        }

        return { ret: 0 };
    }

    /**
     *
     * @param {object} op
     * @returns {Promise<{ret: number, mint_amt: string, service_charge: string}>}
     */
    async _inscribe(op) {
        assert(
            op instanceof PendingInscribeOp,
            `op should be PendingInscribeOp`,
        );
        assert(
            op.state === InscriptionOpState.OK ||
                op.state === InscriptionOpState.COMPETITION_FAILED,
            `op state should be READY or COMPETITION_FAILED: ${op.state}`,
        );

        // 1. transfer amt to mint pool and foundation address
        const amt = op.inscription_item.content.amt;
        assert(
            BigNumberUtil.is_positive_number_string(amt),
            `invalid amt ${amt}`,
        );

        // 98% of the DMC paid by the user for inscribing a public data inscription goes to the DMC Mint Pool, and the remaining 2% goes to the Foundation's account as a handling fee.
        const mint_amt = BigNumberUtil.multiply(amt, 0.98); // amt * 0.98;
        const service_charge = BigNumberUtil.subtract(amt, mint_amt); // amt - mint_amt;

        assert(
            _.isString(this.config.token.account.foundation_address),
            `foundation_address should be string`,
        );

        // 2. subtract mint_amt from address
        const { ret: update_balance_ret } = await this.balance_storage.update_inner_balance(
            op.inscription_item.address,
            BigNumberUtil.multiply(mint_amt, '-1'),
        );
        if (update_balance_ret !== 0) {
            // the balance has been checked in on_inscribe, so should not reach here
            assert(update_balance_ret < 0);
            console.error(
                `failed to transfer inner balance to mint pool ${op.inscription_item.inscription_id} ${op.inscription_item.address} ${mint_amt}`,
            );
            return { ret: update_balance_ret };
        }

        // 2. transfer service_charge from address to foundation address
        const { ret: transfer_ret2 } = await this.balance_storage.transfer_inner_balance(
            op.inscription_item.address,
            this.config.token.account.foundation_address,
            service_charge,
        );
        if (transfer_ret2 !== 0) {
            // the balance has been checked in on_inscribe, so should not reach here
            assert(transfer_ret2 < 0);
            console.error(
                `failed to transfer service charge to foundation ${op.inscription_item.inscription_id} ${op.inscription_item.address} ${service_charge}`,
            );
            return { ret: transfer_ret2 };
        }

        // 3. update the pool balance
        const { ret: update_pool_ret } =
            await this.balance_storage.update_pool_balance_on_ops(
                UpdatePoolBalanceOp.InscribeData,
                '0',
                mint_amt,
            );
        if (update_pool_ret !== 0) {
            assert(update_pool_ret < 0);
            console.error(
                `failed to update mint pool balance ${op.inscription_item.inscription_id}`,
            );
            return { ret: update_pool_ret };
        }

        console.info(
            `new inscribe data record ${op.inscription_item.block_height} ${op.inscription_item.inscription_id} ${op.inscription_item.address} ${op.inscription_item.content.ph} ${op.inscription_item.content.amt} ${op.inscription_item.content.text} ${op.inscription_item.price}`,
        );

        // 4. update inscribe_data table if ready
        if (op.state === InscriptionOpState.OK) {
            const { ret } = await this.storage.add_inscribe_data(
                op.inscription_item.content.ph,
                op.inscription_item.inscription_id,
                op.inscription_item.address,
                op.inscription_item.block_height,
                op.inscription_item.timestamp,
                op.inscription_item.content.text,
                op.inscription_item.price,  // use price field in inscription_item instead of inscription_item.content.price
                0,
            );

            if (ret !== 0) {
                console.error(
                    `failed to add inscribe data ${op.inscription_item.inscription_id}`,
                );
                return { ret };
            }

            // build relation for the first time
            const { ret: update_relation_ret } =
                await this.relation_storage.insert_relation(
                    op.inscription_item.address,
                    op.inscription_item.content.ph,
                    op.inscription_item.inscription_id,
                    op.inscription_item.block_height,
                    op.inscription_item.timestamp,
                    UserHashRelation.Owner,
                );
            if (update_relation_ret !== 0) {
                console.error(
                    `failed to update owner relation ${op.inscription_item.inscription_id} ${op.inscription_item.address} ${op.inscription_item.content.ph}`,
                );
                return { ret: update_relation_ret };
            }
        }

        return { ret: 0, mint_amt, service_charge };
    }
}

module.exports = { InscribeDataOperator };
