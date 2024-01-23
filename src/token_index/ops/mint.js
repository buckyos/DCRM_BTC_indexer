const assert = require('assert');
const { Util, BigNumberUtil } = require('../../util');
const {
    TokenIndexStorage,
    UpdatePoolBalanceOp,
} = require('../../storage/token');
const constants = require('../../constants');
const { InscriptionNewItem } = require('../../index/item');
const { InscriptionOpState, MintType } = require('./state');
const {
    DIFFICULTY_INSCRIBE_LUCKY_MINT_BLOCK_THRESHOLD,
} = require('../../constants');
const { ETHIndex } = require('../../eth/index');

class MintOperator {
    constructor(config, storage, eth_index) {
        assert(_.isObject(config), `config should be object`);
        assert(
            storage instanceof TokenIndexStorage,
            `storage should be TokenIndexStorage`,
        );
        assert(eth_index instanceof ETHIndex, `eth_index should be ETHIndex`);

        this.config = config;
        this.storage = storage;
        this.balance_storage = storage.get_balance_storage();
        this.eth_index = eth_index;

        // load lucky mint block threshold from config
        this.lucky_mint_block_threshold =
            DIFFICULTY_INSCRIBE_LUCKY_MINT_BLOCK_THRESHOLD;
        if (config.token.difficulty.lucky_mint_block_threshold != null) {
            this.lucky_mint_block_threshold =
                config.token.difficulty.lucky_mint_block_threshold;
            assert(_.isNumber(this.lucky_mint_block_threshold));
        }
    }

    /**
     * @comment mint
     * @param {InscriptionNewItem} inscription_item
     * @returns {Promise<{ret: number}>}
     */
    async on_mint(inscription_item) {
        assert(inscription_item instanceof InscriptionNewItem, `invalid item`);

        // do mint
        let { ret, state, amt, mint_type } = await this._on_mint(
            inscription_item,
        );
        if (ret !== 0) {
            return { ret };
        }

        assert(_.isNumber(state), `state should be number ${state}`);

        if (amt == null) {
            amt = '0';
        }
        if (mint_type == null) {
            mint_type = MintType.NormalMint;
        }

        //  add mint record for any state
        const { ret: mint_ret } = await this.storage.add_mint_record(
            inscription_item.inscription_id,
            inscription_item.block_height,
            inscription_item.timestamp,
            inscription_item.txid,
            inscription_item.address,
            JSON.stringify(inscription_item.content),
            amt,
            inscription_item.content.lucky,
            mint_type,
            state,
        );

        if (mint_ret !== 0) {
            console.error(
                `failed to add mint record ${inscription_item.inscription_id}`,
            );
            return { ret: mint_ret };
        }

        return { ret: 0 };
    }

    /**
     *
     * @param {InscriptionNewItem} inscription_item
     * @returns {Promise<{ret: number, state: InscriptionOpState, amt: string | null, mint_type: MintType | null}>}
     */
    async _on_mint(inscription_item) {
        assert(
            inscription_item instanceof InscriptionNewItem,
            `invalid inscription_item on_mint`,
        );

        const content = inscription_item.content;

        // check lucky if exists, then must be string
        if (content.lucky != null) {
            if (!_.isString(content.lucky)) {
                console.error(
                    `lucky should be string ${inscription_item.inscription_id} ${content.lucky}`,
                );

                return {
                    ret: 0,
                    state: InscriptionOpState.INVALID_PARAMS,
                };
            }
        }

        // check amt is exists and is number
        if (
            content.amt == null ||
            !BigNumberUtil.is_positive_number_string(content.amt)
        ) {
            console.error(
                `amt should be number ${inscription_item.inscription_id} ${content.amt}`,
            );

            return {
                ret: 0,
                state: InscriptionOpState.INVALID_PARAMS,
            };
        }

        // amt should <= NORMAL_MINT_MAX_AMOUNT
        if (
            BigNumberUtil.compare(
                content.amt,
                constants.NORMAL_MINT_MAX_AMOUNT,
            ) > 0
        ) {
            console.warn(
                `amt should be less than ${constants.NORMAL_MINT_MAX_AMOUNT} ${inscription_item.inscription_id} ${content.amt}`,
            );

            return {
                ret: 0,
                state: InscriptionOpState.INVALID_PARAMS,
            };
        }

        // check the mint type: normal mint, lucky mint, burn mint
        // only can be lucky mint or burn mint if lucky field exists and is valid string!
        let amt;
        let inner_amt;
        let mint_type = MintType.NormalMint;

        if (content.lucky != null && _.isString(content.lucky)) {
            // first query is if the burn mint from eth
            const {
                ret,
                valid,
                amount: burn_amount,
            } = await this._query_burn_mint(inscription_item);
            if (ret !== 0) {
                console.error(
                    `failed to query lucky mint ${inscription_item.inscription_id} ${inscription_item.address} ${content.lucky}`,
                );
                return { ret };
            }

            if (valid) {
                assert(
                    _.isString(burn_amount),
                    `burn_amount should be string: ${burn_amount}`,
                );

                mint_type = MintType.BurnMint;
                amt = content.amt;
                inner_amt = burn_amount;
            } else {
                // not burn mint, now check if it is lucky mint
                if (this._is_lucky_block_mint(inscription_item)) {
                    mint_type = MintType.LuckyMint;

                    console.log(
                        `lucky mint ${inscription_item.inscription_id} ${inscription_item.address} ${content.lucky} ${content.amt}`,
                    );

                    amt = content.amt;

                    // lucky mint amount is 10 times of normal mint - normal mint amount
                    inner_amt = BigNumberUtil.multiply(content.amt, 9);

                    // if content.amt > constants.LUCKY_MINT_MAX_AMOUNT, then will use the max amount
                    if (
                        BigNumberUtil.compare(
                            inner_amt,
                            constants.LUCKY_MINT_MAX_AMOUNT,
                        ) > 0
                    ) {
                        console.warn(
                            `lucky mint amount is too large ${inscription_item.inscription_id} ${content.amt} ${amt}`,
                        );
                        inner_amt = constants.LUCKY_MINT_MAX_AMOUNT;
                    }
                }
            }
        }

        if (mint_type === MintType.NormalMint) {
            console.log(
                `normal mint ${inscription_item.inscription_id} ${inscription_item.address} ${content.amt}`,
            );

            amt = content.amt;
            inner_amt = '0';
        }

        // first update mint pool balance
        let update_pool_op;
        switch (mint_type) {
            case MintType.NormalMint: {
                update_pool_op = UpdatePoolBalanceOp.Mint;
                break;
            }
            case MintType.LuckyMint: {
                update_pool_op = UpdatePoolBalanceOp.LuckyMint;
                break;
            }
            case MintType.BurnMint: {
                update_pool_op = UpdatePoolBalanceOp.BurnMint;
                break;
            }
            default: {
                assert(false, `invalid mint_type ${mint_type}`);
            }
        }

        const { ret: update_mint_pool_balance_ret } =
            await this.balance_storage.update_pool_balance_on_ops(
                update_pool_op,
                amt,
                inner_amt,
            );
        if (update_mint_pool_balance_ret < 0) {
            console.error(
                `failed to update mint pool balance ${inscription_item.inscription_id}`,
            );
            return { ret: update_mint_pool_balance_ret };
        }

        let state = 0;
        if (update_mint_pool_balance_ret > 0) {
            assert(
                update_mint_pool_balance_ret ===
                    InscriptionOpState.INSUFFICIENT_BALANCE,
            );
            state = InscriptionOpState.INSUFFICIENT_BALANCE;
        } else {
            // then update balance for the address if the pool balance is enough
            const { ret } = await this.balance_storage.update_balance(
                inscription_item.address,
                amt,
            );
            if (ret !== 0) {
                assert(ret < 0);
                console.error(
                    `failed to update balance ${inscription_item.inscription_id}`,
                );

                return { ret };
            }

            // then update inner balance for the address if the pool balance is enough
            if (inner_amt !== '0') {
                const { ret: inner_ret } =
                    await this.balance_storage.update_inner_balance(
                        inscription_item.address,
                        inner_amt,
                    );
                if (inner_ret !== 0) {
                    assert(inner_ret < 0);
                    console.error(
                        `failed to update inner balance ${inscription_item.inscription_id}`,
                    );

                    return { ret: inner_ret };
                }
            }
        }

        return { ret: 0, state, amt, inner_amt, mint_type };
    }

    /**
     * @comment check if the mint is burn mint: 1. should exists on eth contract 2. should not exists on mint records
     * @param {object} inscription_item
     * @returns {Promise<{ret: number, valid: boolean, amount: string}>}
     */
    async _query_burn_mint(inscription_item) {
        const { ret, exists, amount } = await this.eth_index.query_lucky_mint(
            inscription_item.address,
            inscription_item.content.lucky,
        );
        if (ret !== 0) {
            console.error(
                `failed to query burn mint ${inscription_item.inscription_id} ${inscription_item.address} ${inscription_item.content.burn}`,
            );
            return { ret };
        }

        if (!exists) {
            return { ret: 0, valid: false };
        }
        assert(_.isString(amount), `amount should be string ${amount}`);

        // can only mint once!
        const { ret: query_ret, data } = await this.storage.query_lucky_mint(
            inscription_item.address,
            inscription_item.content.lucky,
        );
        if (query_ret !== 0) {
            console.error(
                `failed to query lucky mint ${inscription_item.inscription_id} ${inscription_item.address} ${inscription_item.content.lucky}`,
            );
            return { ret: query_ret };
        }

        if (data == null) {
            return { ret: 0, valid: true, amount };
        }

        if (data.mint_type === MintType.BurnMint) {
            console.warn(
                `already burn mint ${inscription_item.inscription_id} ${inscription_item.address} ${inscription_item.content.lucky}`,
            );
            return { ret: 0, valid: false };
        } else {
            console.info(
                `lucky mint exists but not burn mint! ${inscription_item.inscription_id} ${inscription_item.address} ${inscription_item.content.lucky}`,
            );
            return { ret: 0, valid: true, amount };
        }
    }

    _is_lucky_block_mint(inscription_item) {
        const { block_height, address } = inscription_item;
        assert(_.isNumber(block_height), `block_height should be number`);
        assert(_.isString(address), `address should be string`);

        // Get the number of the address
        const address_num = Util.address_number(address);

        // Check if the sum of the block height and the ASCII value is divisible by block_threshold
        if (
            (block_height + address_num) % this.lucky_mint_block_threshold ===
            0
        ) {
            // Special handling for this inscription_item
            return true;
        } else {
            // Normal handling for this inscription_item
            return false;
        }
    }
}

module.exports = { MintOperator };
