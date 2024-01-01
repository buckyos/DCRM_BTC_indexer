const assert = require('assert');
const { Util } = require('../../util');
const { TokenIndexStorage } = require('../../storage/token');
const { HashHelper } = require('./hash');
const { InscriptionOpState } = require('./state');
const { InscriptionNewItem, InscriptionTransferItem } = require('../item');

class PendingInscribeOp {
    constructor(inscription_item, state, hash_distance) {
        this.inscription_item = inscription_item;
        this.state = state;
        this.hash_distance = hash_distance;
    }
}

class InscribeDataOperator {
    constructor(config, storage, hash_helper) {
        assert(config, `config should not be null`);
        assert(storage instanceof TokenIndexStorage, `storage should be TokenIndex`);
        assert(
            hash_helper instanceof HashHelper,
            `hash_helper should be HashHelper`,
        );

        this.config = config;
        this.storage = storage;
        this.hash_helper = hash_helper;

        // pending operations that with some restrictions in the same block
        this.pending_inscribe_ops = [];
    }

    /**
     * @comment processed on the inscription transfered
     * @param {InscriptionTransferItem} inscription_transfer_item
     * @returns {Promise<{ret: number}>}
     */
    async on_transfer(inscription_transfer_item) {
        assert(
            inscription_transfer_item instanceof InscriptionTransferItem,
            `invalid inscribe data transfer item`,
        );

        assert(
            inscription_transfer_item.index > 0,
            `invalid transfer index ${inscription_transfer_item.inscription_id}`,
        );

        // first query the inscribe record
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
            return { ret: 0 };
        }

        assert(
            _.isString(record.hash),
            `invalid inscribe record hash ${inscription_transfer_item.inscription_id}`,
        );
        const hash = record.hash;

        // then query current inscribed data
        const { ret: get_inscribe_data_ret, data } =
            await this.storage.get_inscribe_data(hash);
        if (get_inscribe_data_ret !== 0) {
            console.error(
                `failed to get inscribe data ${inscription_transfer_item.inscription_id} ${hash}`,
            );
            return { ret: get_inscribe_data_ret };
        }

        if (data == null) {
            // FIXME should not reach here
            console.error(
                `inscribe data not exists ${inscription_transfer_item.inscription_id} ${hash}`,
            );
            return { ret: 0 };
        }

        // check if the block_height is greater than the current block_height
        assert(
            _.isNumber(data.block_height),
            `invalid inscribe data block_height ${inscription_transfer_item.inscription_id} ${hash}`,
        );
        if (inscription_transfer_item.block_height <= data.block_height) {
            console.error(
                `invalid inscribe data block_height ${inscription_transfer_item.inscription_id} ${hash} ${inscription_transfer_item.block_height} <= ${data.block_height}`,
            );
            return { ret: 0 };
        }

        // update owner with transfer_inscribe_data_owner
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
                return { ret: 0 };
            } else {
                console.error(
                    `failed to update inscribe data owner ${inscription_transfer_item.inscription_id} ${hash}`,
                );
                return { ret: update_owner_ret };
            }
        }

        console.log(
            `transfer inscribe data owner ${inscription_transfer_item.inscription_id} ${hash} ${data.address} -> ${inscription_transfer_item.to_address}`,
        );

        return { ret: 0 };
    }

    /**
     *
     * @param {InscriptionNewItem} inscription_item
     * @returns {Promise<{ret: number}>}
     */
    async on_inscribe(inscription_item) {
        assert(inscription_item instanceof InscriptionNewItem, `invalid item`);

        // first check if hash and amt field is exists
        const hash = inscription_item.content.ph;
        if (hash == null || !_.isString(hash)) {
            console.warn(
                `invalid inscription ph ${inscription_item.inscription_id} ${hash}`,
            );

            // invalid format, so we should ignore this inscription
            return { ret: 0 };
        }

        const amt = inscription_item.content.amt;
        if (amt == null || !_.isNumber(amt)) {
            console.error(
                `invalid inscription amt ${inscription_item.inscription_id} ${amt}`,
            );
            return { ret: 0 };
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
            const op = new PendingInscribeOp(
                inscription_item,
                InscriptionOpState.ALREADY_EXISTS,
                0,
            );
            this.pending_inscribe_ops.push(op);

            return { ret: 0 };
        }

        // 2. chech hash condition if satisfied
        assert(inscription_item.commit_txid != null);
        if (
            !Util.check_inscribe_hash_and_txid(
                hash,
                inscription_item.commit_txid,
            )
        ) {
            // not match (hash - commit_txid) % 32 != 0, so this inscription will failed
            const op = new PendingInscribeOp(
                inscription_item,
                InscriptionOpState.HASH_UNMATCH,
                0,
            );
            this.pending_inscribe_ops.push(op);

            return { ret: 0 };
        }

        // 3. check weight with amt, amt must be greater than hash weight
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

        // check if hash weight is less than amt
        if (hash_weight > amt) {
            console.warn(
                `hash weight is less than amt ${inscription_item.inscription_id} ${hash_weight} < ${amt}`,
            );

            // hash weight is less than amt, so this inscription will failed
            const op = new PendingInscribeOp(
                inscription_item,
                InscriptionOpState.INVALID_AMT,
                0,
            );
            this.pending_inscribe_ops.push(op);

            return { ret: 0 };
        }

        // 4. check if address balance is enough
        const { ret: get_balance_ret, balance } =
            await this.storage.get_balance(inscription_item.address);
        if (get_balance_ret !== 0) {
            console.error(
                `failed to get balance ${inscription_item.inscription_id} ${inscription_item.address}`,
            );
            return { ret: get_balance_ret };
        }

        if (balance < amt) {
            console.warn(
                `balance is not enough ${inscription_item.inscription_id} ${inscription_item.address} ${balance} < ${amt}`,
            );

            // balance is not enough, so this inscription will failed
            const op = new PendingInscribeOp(
                inscription_item,
                InscriptionOpState.INSUFFICIENT_BALANCE,
                0,
            );
            this.pending_inscribe_ops.push(op);

            return { ret: 0 };
        }

        // 5. calc distance of (address, hash)
        // if there is multiple inscribe in the same block, we should select the one had the shortest distance
        const distance = Util.calc_distance_with_hash_and_address(
            hash,
            inscription_item.address,
        );
        const new_op = new PendingInscribeOp(
            inscription_item,
            InscriptionOpState.OK,
            distance,
        );

        // 6. check if there is any pending inscribe op in the same block with same hash
        for (const op of this.pending_inscribe_ops) {
            if (
                op.state === InscriptionOpState.OK &&
                op.inscription_item.content.ph === hash
            ) {
                if (op.hash_distance <= distance) {
                    // competition failed
                    console.warn(
                        `competition failed in same block! new: ${inscription_item.inscription_id} old: ${op.inscription_item.inscription_id}, new ${distance} > old ${op.hash_distance}`,
                    );
                    new_op.state = InscriptionOpState.COMPETITION_FAILED;
                } else {
                    console.warn(
                        `competition failed in same block! new: ${inscription_item.inscription_id} old: ${op.inscription_item.inscription_id}, old ${op.hash_distance} > new ${distance}`,
                    );
                    op.state = InscriptionOpState.COMPETITION_FAILED;
                }
            }
        }

        this.pending_inscribe_ops.push(op);

        return { ret: 0 };
    }

    async process_pending_inscribe_ops() {
        for (const op of this.pending_inscribe_ops) {
            if (
                op.state === InscriptionOpState.OK ||
                op.state === InscriptionOpState.COMPETITION_FAILED
            ) {
                const { ret } = await this._inscribe(op);
                if (ret !== 0) {
                    console.error(
                        `failed to process pending inscribe op ${op.inscription_item.inscription_id}`,
                    );
                    return { ret };
                }
            }
        }

        return { ret: 0 };
    }

    async _inscribe(op) {
        assert(
            op instanceof PendingInscribeOp,
            `op should be PendingInscribeOp`,
        );
        assert(
            op.state === InscriptionOpState.READY ||
                op.state === InscriptionOpState.COMPETITION_FAILED,
            `op state should be READY or COMPETITION_FAILED`,
        );

        // 1. transfer amt to mint pool and foundation address
        const amt = op.inscription_item.content.amt;
        assert(amt > 0, `amt should be positive`);

        // 98% of the DMC paid by the user for inscribing a public data inscription goes to the DMC Mint Pool, and the remaining 2% goes to the Foundation's account as a handling fee.
        const mint_amt = amt * 0.98;
        const service_charge = amt - mint_amt;

        assert(
            _.isString(this.config.token.account.mint_pool_address),
            `mint_pool_address should be string`,
        );
        assert(
            _.isString(this.config.token.account.foundation_address),
            `foundation_address should be string`,
        );

        const { ret: transfer_ret } = await this.storage.transfer_balance(
            op.inscription_item.address,
            this.config.token.account.mint_pool_address,
            mint_amt,
        );
        if (transfer_ret !== 0) {
            console.error(
                `failed to transfer balance to mint pool ${op.inscription_item.inscription_id} ${op.inscription_item.address} ${mint_amt}`,
            );
            return { ret: transfer_ret };
        }

        const { ret: transfer_ret2 } = await this.storage.transfer_balance(
            op.inscription_item.address,
            this.config.token.account.foundation_address,
            service_charge,
        );
        if (transfer_ret2 !== 0) {
            console.error(
                `failed to transfer service charge to foundation ${op.inscription_item.inscription_id} ${op.inscription_item.address} ${service_charge}`,
            );
            return { ret: transfer_ret2 };
        }

        // 2. record inscribe op
        const { ret: record_ret } = await this.storage.add_inscribe_data_record(
            op.inscription_item.inscription_id,
            op.inscription_item.block_height,
            op.inscription_item.address,
            op.inscription_item.timestamp,
            op.inscription_item.content.ph,
            mint_amt,
            service_charge,
            op.inscription_item.content.text,
            op.inscription_item.content.price,
            op.state,
        );
        if (record_ret !== 0) {
            console.error(
                `failed to record inscribe op ${op.inscription_item.inscription_id}`,
            );
            return { ret: record_ret };
        }

        // 3. update inscribe_data table if ready
        if (op.state === InscriptionOpState.READY) {
            const { ret } = await this.storage.add_inscribe_data(
                op.inscription_item.content.ph,
                op.inscription_item.address,
                op.inscription_item.block_height,
                op.inscription_item.timestamp,
                op.inscription_item.content.text,
                op.inscription_item.content.price,
                0,
            );

            if (ret !== 0) {
                console.error(
                    `failed to add inscribe data ${op.inscription_item.inscription_id}`,
                );
                return { ret };
            }
        }

        return { ret: 0 };
    }
}

module.exports = { InscribeDataOperator };
