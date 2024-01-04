const assert = require('assert');
const { Util, BigNumberUtil } = require('../../util');
const {
    TokenIndexStorage,
    UpdatePoolBalanceOp,
} = require('../../storage/token');
const { HashHelper } = require('./hash');
const { InscriptionOpState } = require('./state');
const { InscriptionNewItem } = require('../item');
const { TOKEN_MINT_POOL_VIRTUAL_ADDRESS, DIFFICULTY_CHANT_BLOCK_THRESHOLD } = require('../../constants');

class ChantOperator {
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

        // The same user can only successfully chant once in a block
        this.user_chant_ops = new Map();

        // load difficulty of chant block threshold from config
        this.chant_block_threshold =
            DIFFICULTY_CHANT_BLOCK_THRESHOLD;
        if (config.token.difficulty.chant_block_threshold != null) {
            this.chant_block_threshold =
                config.token.difficulty.chant_block_threshold;
            assert(_.isNumber(this.chant_block_threshold));
        }
    }

    /**
     *
     * @param {InscriptionNewItem} inscription_item
     * @returns {Promise<{ret: number}>}
     */
    async on_chant(inscription_item) {
        assert(inscription_item instanceof InscriptionNewItem, `invalid item`);

        // first do chant
        const { ret, state } = await this._chant(inscription_item);
        if (ret !== 0) {
            return { ret };
        }

        // record chant op
        const { ret: record_ret } = await this.storage.add_chant_record(
            inscription_item.inscription_id,
            inscription_item.block_height,
            inscription_item.timestamp,
            inscription_item.txid,
            inscription_item.address,
            JSON.stringify(inscription_item.content),
            inscription_item.content.ph,
            inscription_item.user_bonus,
            inscription_item.owner_bonus,
            state,
        );
        if (record_ret !== 0) {
            console.error(
                `failed to record chant ${inscription_item.inscription_id} ${inscription_item.address} ${inscription_item.content.ph}`,
            );
            return { ret: record_ret };
        }

        return { ret: 0 };
    }

    /**
     *
     * @param {InscriptionNewItem} inscription_item
     * @returns {Promise<{ret: number, state: number}>}
     */
    async _chant(inscription_item) {
        assert(inscription_item instanceof InscriptionNewItem, `invalid item`);

        // should be init to zero on start
        inscription_item.user_bonus = '0';
        inscription_item.owner_bonus = '0';

        // first check if hash field is exists
        const hash = inscription_item.content.ph;
        if (hash == null || !_.isString(hash)) {
            console.warn(
                `invalid inscription ph ${inscription_item.inscription_id} ${hash}`,
            );

            // invalid format, so we should ignore this inscription
            return { ret: 0, state: InscriptionOpState.INVALID_PARAMS };
        }

        // 1. check permission
        // check hash's owner address
        const { ret: get_owner_ret, data } =
            await this.storage.get_inscribe_data(hash);
        if (get_owner_ret !== 0) {
            console.error(
                `failed to get owner of hash ${inscription_item.inscription_id} ${hash}`,
            );
            return { ret: get_owner_ret };
        }

        if (data == null) {
            console.warn(
                `chant hash not found ${inscription_item.inscription_id} ${hash}`,
            );
            return { ret: 0, state: InscriptionOpState.HASH_NOT_FOUND };
        }

        // The user has the inscription or the user resonates the data inscription
        assert(data.address != null, `invalid owner address of hash ${hash}`);
        if (data.address !== inscription_item.address) {
            const { ret, data } = await this.storage.query_user_resonance(
                inscription_item.address,
                hash,
            );
            if (ret !== 0) {
                console.error(
                    `failed to query user resonance ${inscription_item.inscription_id} ${hash}`,
                );
                return { ret };
            }

            if (data == null) {
                console.warn(
                    `user not have resonate the hash yet ${inscription_item.inscription_id} ${inscription_item.address} ${hash}`,
                );

                return { ret: 0, state: InscriptionOpState.PERMISSION_DENIED };
            } else {
                // The user has resonate the hash
            }
        } else {
            // The user has the inscription
        }

        // 2. check hash relation
        const hash_num = Util.address_number(hash);
        if (Math.abs(hash_num - inscription_item.block_height) % this.chant_block_threshold !== 0) {
            console.warn(
                `invalid hash relation ${inscription_item.inscription_id} hash: ${hash} block: ${inscription_item.block_height}`,
            );

            return { ret: 0, state: InscriptionOpState.HASH_UNMATCHED };
        }

        // 3. check weight of hash
        // Chant Bonus = weight and Chant Stamina = weight / 4, and user' balance should be enough: balance >= chant stamina

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

        assert(_.isString(hash_weight), `invalid hash weight ${hash_weight}`);
        let bonus = hash_weight;
        // const stamina = hash_weight / 4;
        const stamina = BigNumberUtil.divide(hash_weight, 4);

        const { ret: get_balance_ret, amount } = await this.storage.get_balance(
            inscription_item.address,
        );
        if (get_balance_ret !== 0) {
            console.error(
                `failed to get balance ${inscription_item.inscription_id} ${inscription_item.address}`,
            );
            return { ret: get_balance_ret };
        }

        assert(_.isString(amount), `invalid balance ${amount}`);
        if (BigNumberUtil.compare(amount, stamina) < 0) {
            console.error(
                `not enough balance ${inscription_item.inscription_id} ${inscription_item.address} ${amount} < ${stamina}`,
            );
            return { ret: 0, state: InscriptionOpState.INSUFFICIENT_BALANCE };
        }

        // 4. check if already has one chant op in this block
        const user_chant_op = this.user_chant_ops.get(inscription_item.address);
        if (user_chant_op != null) {
            console.warn(
                `user already has chant op in this block ${inscription_item.inscription_id} ${inscription_item.address}`,
            );
            return { ret: 0, state: InscriptionOpState.ALREADY_EXISTS };
        }
        this.user_chant_ops.set(inscription_item.address, inscription_item);

        // 5. check Mint pool left balance
        const { ret: get_mint_pool_ret, amount: mint_pool_balance } =
            await this.storage.get_balance(TOKEN_MINT_POOL_VIRTUAL_ADDRESS);

        if (get_mint_pool_ret !== 0) {
            console.error(
                `failed to get mint pool balance ${inscription_item.inscription_id} ${TOKEN_MINT_POOL_VIRTUAL_ADDRESS}`,
            );
            return { ret: get_mint_pool_ret };
        }

        assert(
            BigNumberUtil.is_positive_number_string(mint_pool_balance),
            `invalid mint pool balance ${mint_pool_balance}`,
        );

        // if bonus > mint_pool_balance then bonus = mint_pool_balance
        if (BigNumberUtil.compare(bonus, mint_pool_balance) > 0) {
            console.warn(
                `not enough mint pool balance for bonus ${inscription_item.inscription_id} ${mint_pool_balance} < ${bonus}`,
            );
            bonus = mint_pool_balance;
        }

        // is bonus is zero, then we should ignore this inscription
        if (BigNumberUtil.compare(bonus, 0) <= 0) {
            console.warn(
                `empty mint pool balance ${inscription_item.inscription_id} ${mint_pool_balance} < ${bonus}`,
            );
            return { ret: 0, state: InscriptionOpState.INSUFFICIENT_BALANCE };
        }

        // 6. trans bonus to user and owner
        let user_bonus;
        let owner_bonus;
        if (data.address !== inscription_item.address) {
            // user_bonus = bonus * 0.8;
            user_bonus = BigNumberUtil.multiply(bonus, 0.8);

            // owner_bonus = bonus - user_bonus;
            owner_bonus = BigNumberUtil.subtract(bonus, user_bonus);
        } else {
            user_bonus = bonus;
            owner_bonus = '0';
        }

        // if user_bonus > 0
        if (BigNumberUtil.compare(user_bonus, 0) > 0) {
            const { ret } = await this.storage.update_balance(
                inscription_item.address,
                user_bonus,
            );
            if (ret !== 0) {
                assert(ret < 0);
                console.error(
                    `failed to transfer user bonus ${inscription_item.inscription_id} ${inscription_item.address} ${user_bonus}`,
                );
                return { ret };
            }

            console.info(
                `chant success transfer to user ${inscription_item.inscription_id} ${inscription_item.address} ${user_bonus}`,
            );
        }

        // if owner_bonus > 0
        if (BigNumberUtil.compare(owner_bonus, 0) > 0) {
            const { ret } = await this.storage.update_balance(
                data.address,
                owner_bonus,
            );
            if (ret !== 0) {
                assert(ret < 0);
                console.error(
                    `failed to transfer owner bonus ${inscription_item.inscription_id} ${data.address} ${owner_bonus}`,
                );
                return { ret };
            }

            console.info(
                `chant success transfer to owner ${inscription_item.inscription_id} ${data.address} ${owner_bonus}`,
            );
        }

        inscription_item.user_bonus = user_bonus;
        inscription_item.owner_bonus = owner_bonus;

        // 7. update pool amount
        const { ret: update_pool_ret } =
            await this.storage.update_pool_balance_on_ops(
                UpdatePoolBalanceOp.Chant,
                bonus,
            );
        if (update_pool_ret !== 0) {
            assert(update_pool_ret < 0);
            console.error(
                `failed to update pool balance ${inscription_item.inscription_id} ${bonus}`,
            );
            return { ret: update_pool_ret };
        }

        return { ret: 0, state: InscriptionOpState.OK };
    }
}

module.exports = { ChantOperator };
