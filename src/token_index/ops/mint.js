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
    TOKEN_MINT_POOL_VIRTUAL_ADDRESS,
} = require('../../constants');
const { ETHIndex } = require('../../eth/index');
const { BalanceOp } = require('../../storage/balance');

// const { OkLinkService } = require('../../btc/oklink');

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

        this.normal_mint_max_amount = constants.NORMAL_MINT_MAX_AMOUNT;
        this.lucky_mint_max_amount = constants.LUCKY_MINT_MAX_AMOUNT;
        if (_.isString(config.token.normal_mint_max_amount)) {
            assert(
                BigNumberUtil.is_positive_number_string(
                    config.token.normal_mint_max_amount,
                ),
                `invalid normal_mint_max_amount ${config.token.normal_mint_max_amount}`,
            );
            this.normal_mint_max_amount = config.token.normal_mint_max_amount;
        }

        if (_.isString(config.token.lucky_mint_max_amount)) {
            assert(
                BigNumberUtil.is_positive_number_string(
                    config.token.lucky_mint_max_amount,
                ),
                `invalid lucky_mint_max_amount ${config.token.lucky_mint_max_amount}`,
            );
            this.lucky_mint_max_amount = config.token.lucky_mint_max_amount;
        }

        // use for debug verify
        // this.oklink_service = new OkLinkService(config);
    }

    /**
     * @comment mint
     * @param {InscriptionNewItem} inscription_item
     * @returns {Promise<{ret: number}>}
     */
    async on_mint(inscription_item) {
        assert(inscription_item instanceof InscriptionNewItem, `invalid item`);

        // do mint
        let { ret, state, amt, inner_amt, mint_type } = await this._on_mint(
            inscription_item,
        );
        if (ret !== 0) {
            return { ret };
        }

        assert(_.isNumber(state), `state should be number ${state}`);

        /*
        // verify by oklink service
        const { ret: verify_ret, info } = await this.oklink_service.get_inscription_detail(inscription_item.inscription_id);
        if (verify_ret !== 0) {
            console.error(`failed to verify inscription ${inscription_item.inscription_id}`);
            return { ret: verify_ret };
        }

        if (state === 0) {
            // if state is 0, then should be success
            assert(info.state === 'success', `invalid state ${info.state}, ${inscription_item.inscription_id}}`);
            if (info.state !== 'success') {
                
            }
        } else {
            // if state is not 0, then should be fail
            console.log(info.msg);
            assert(info.state === 'fail', `invalid state ${info.state}, ${inscription_item.inscription_id}}`);
            if (info.state !== 'fail') {
                
            }
        }
        */

        if (amt == null) {
            amt = '0';
        }
        if (inner_amt == null) {
            inner_amt = '0';
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
            inner_amt,
            inscription_item.lucky, // use inscription_item.lucky instead of content.lucky for param check
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
     * @returns {Promise<{ret: number, state: InscriptionOpState, amt: string | null, inner_amt: string | null, mint_type: MintType | null}>}
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
                console.warn(
                    `lucky should be string ${inscription_item.inscription_id} ${content.lucky}`,
                );

                return {
                    ret: 0,
                    state: InscriptionOpState.INVALID_PARAMS,
                };
            }
        }
        inscription_item.lucky = content.lucky;

        // check amt is exists and is number
        if (
            content.amt == null ||
            !BigNumberUtil.is_positive_number_string(content.amt)
        ) {
            console.warn(
                `amt should be valid number string ${inscription_item.inscription_id} ${content.amt}`,
            );

            return {
                ret: 0,
                state: InscriptionOpState.INVALID_PARAMS,
            };
        }

        // amt should <= this.normal_mint_max_amount
        if (
            BigNumberUtil.compare(content.amt, this.normal_mint_max_amount) > 0
        ) {
            console.warn(
                `amt should be less than ${this.normal_mint_max_amount} ${inscription_item.inscription_id} ${content.amt}`,
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

                    // if content.amt > this.lucky_mint_max_amount, then will use the max amount
                    if (
                        BigNumberUtil.compare(
                            inner_amt,
                            this.lucky_mint_max_amount,
                        ) > 0
                    ) {
                        console.warn(
                            `lucky mint amount is too large ${inscription_item.inscription_id} ${content.amt} ${amt}`,
                        );
                        inner_amt = this.lucky_mint_max_amount;
                    }
                }
            }
        }

        if (mint_type === MintType.NormalMint) {
            amt = content.amt;
            inner_amt = '0';

            console.log(
                `normal mint ${inscription_item.inscription_id} ${inscription_item.address} ${amt}`,
            );
        }

        // check mint pool limit
        const { ret: get_mint_pool_balance_ret, amount: mint_pool_amount } =
            await this.balance_storage.get_inner_balance(
                TOKEN_MINT_POOL_VIRTUAL_ADDRESS,
            );
        if (get_mint_pool_balance_ret !== 0) {
            console.error(
                `failed to get mint pool balance ${inscription_item.inscription_id}`,
            );
            return { ret: get_mint_pool_balance_ret };
        }

        // if the mint pool balance is exhausted, then return with insufficient balance state
        if (BigNumberUtil.compare(mint_pool_amount, '0') <= 0) {
            console.warn(
                `mint pool balance is not enough ${inscription_item.inscription_id} ${mint_pool_amount}`,
            );
            return {
                ret: 0,
                state: InscriptionOpState.INSUFFICIENT_BALANCE,
            };
        }

        // if total > mint_pool_amount, then first try to deduct inner_amt, then try to deduct amt
        const total = BigNumberUtil.add(amt, inner_amt);
        if (BigNumberUtil.compare(total, mint_pool_amount) > 0) {
            console.warn(
                `mint pool limit exceeded ${inscription_item.inscription_id} ${total} ${mint_pool_amount}`,
            );

            // try to deduct inner_amt
            const extend_amount = BigNumberUtil.subtract(
                total,
                mint_pool_amount,
            );
            inner_amt = BigNumberUtil.subtract(inner_amt, extend_amount);
            if (BigNumberUtil.compare(inner_amt, '0') < 0) {
                amt = BigNumberUtil.add(amt, inner_amt);
                inner_amt = '0';
            }
        }

        // first update mint pool balance
        let update_pool_op;
        let balance_op;
        switch (mint_type) {
            case MintType.NormalMint: {
                update_pool_op = UpdatePoolBalanceOp.Mint;
                balance_op = BalanceOp.Mint;
                break;
            }
            case MintType.LuckyMint: {
                update_pool_op = UpdatePoolBalanceOp.LuckyMint;
                balance_op = BalanceOp.LuckyMint;
                break;
            }
            case MintType.BurnMint: {
                update_pool_op = UpdatePoolBalanceOp.BurnMint;
                balance_op = BalanceOp.BurnMint;
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

            // add balance record for user address
            const { ret: add_balance_record_ret } =
                await this.balance_storage.add_balance_record(
                    inscription_item.inscription_id,
                    inscription_item.address,
                    amt,
                    null,
                    inscription_item.block_height,
                    inscription_item.timestamp,
                    balance_op,
                );
            if (add_balance_record_ret !== 0) {
                console.error(
                    `failed to add balance record ${inscription_item.inscription_id}`,
                );
                return { ret: add_balance_record_ret };
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

                // add inner balance record for user address
                const { ret: add_inner_balance_record_ret } =
                    await this.balance_storage.add_inner_balance_record(
                        inscription_item.inscription_id,
                        inscription_item.address,
                        inner_amt,
                        null,
                        inscription_item.block_height,
                        inscription_item.timestamp,
                        balance_op,
                    );
                if (add_inner_balance_record_ret !== 0) {
                    console.error(
                        `failed to add inner balance record ${inscription_item.inscription_id}`,
                    );
                    return { ret: add_inner_balance_record_ret };
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
