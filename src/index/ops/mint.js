const assert = require('assert');
const { Util, BigNumberUtil } = require('../../util');
const {
    TokenIndexStorage,
    UpdatePoolBalanceOp,
} = require('../../storage/token');
const constants = require('../../constants');
const { InscriptionNewItem } = require('../item');
const { InscriptionOpState } = require('./state');

class MintOperator {
    constructor(config, storage) {
        assert(_.isObject(config), `config should be object`);
        assert(
            storage instanceof TokenIndexStorage,
            `storage should be TokenIndexStorage`,
        );

        this.config = config;
        this.storage = storage;
    }

    /*
    使用标准的Orindal协议进行Mint，根据现在部署的BRC20，成功获得210个DMC 我们的扩展增加了“lucky”关键字（最长32个字节），当带有该关键字的交易进入被 区块高度与自己的地址的和被64整除的区块时，用户会得到2100个DMC。lucky mint在未进入正确区块时，蜕化成普通mint,获得上限规定的210个DMC.

    {"p":"brc-20","op":"mint","tick":"DMC ","amt":"2100","lucky":"dmc-discord"}
    */
    async on_mint(inscription_item) {
        assert(
            inscription_item instanceof InscriptionNewItem,
            `invalid inscription_item on_mint`,
        );

        // check amt is exists and is number
        const content = inscription_item.content;

        if (content.lucky != null) {
            if (!_.isString(content.lucky)) {
                console.error(
                    `lucky should be string ${inscription_item.inscription_id} ${content.lucky}`,
                );

                return {
                    ret: 0,
                };
            }
        }

        if (!BigNumberUtil.is_positive_number_string(content.amt)) {
            console.error(
                `amt should be number ${inscription_item.inscription_id} ${content.amt}`,
            );

            return {
                ret: 0,
            };
        }

        let amt;
        let is_lucky_mint = false;
        if (
            content.lucky != null &&
            this._is_lucky_block_mint(inscription_item)
        ) {
            console.log(
                `lucky mint ${inscription_item.inscription_id} ${inscription_item.address} ${content.lucky}`,
            );

            // if content.amt > constants.LUCKY_MINT_MAX_AMOUNT
            if (
                BigNumberUtil.compare(
                    content.amt,
                    constants.LUCKY_MINT_MAX_AMOUNT,
                ) > 0
            ) {
                console.warn(
                    `lucky mint amount is too large ${inscription_item.inscription_id} ${content.amt}`,
                );
                content.origin_amt = amt;
                amt = constants.LUCKY_MINT_MAX_AMOUNT;
            } else {
                amt = content.amt;
            }

            is_lucky_mint = true;
        } else {
            console.log(
                `mint ${inscription_item.inscription_id} ${inscription_item.address} ${content.amount}`,
            );

            // if content.amt > constants.NORMAL_MINT_MAX_AMOUNT
            if (
                BigNumberUtil.compare(
                    content.amt,
                    constants.NORMAL_MINT_MAX_AMOUNT,
                ) > 0
            ) {
                console.warn(
                    `mint amount is too large ${inscription_item.inscription_id} ${inscription_item.address} ${content.amt}`,
                );

                amt = constants.NORMAL_MINT_MAX_AMOUNT;
            } else {
                amt = content.amt;
            }
        }

        // first update mint pool balance
        const update_pool_op = is_lucky_mint
            ? UpdatePoolBalanceOp.LuckyMint
            : UpdatePoolBalanceOp.Mint;
        const { ret: update_mint_pool_balance_ret } =
            await this.storage.update_pool_balance_on_ops(update_pool_op, amt);
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
            const { ret } = await this.storage.update_balance(
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
        }

        // then add mint record
        const { ret: mint_ret } = await this.storage.add_mint_record(
            inscription_item.inscription_id,
            inscription_item.block_height,
            inscription_item.timestamp,
            inscription_item.txid,
            inscription_item.address,
            JSON.stringify(content),
            amt,
            content.lucky,
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

    _is_lucky_block_mint(inscription_item) {
        const { block_height, address } = inscription_item;
        assert(_.isNumber(block_height), `block_height should be number`);
        assert(_.isString(address), `address should be string`);

        // Get the number of the address
        const address_num = Util.address_number(address);

        // Check if the sum of the block height and the ASCII value is divisible by 64
        if ((block_height + address_num) % 64 === 0) {
            // Special handling for this inscription_item
            return true;
        } else {
            // Normal handling for this inscription_item
            return false;
        }
    }
}

module.exports = { MintOperator };
