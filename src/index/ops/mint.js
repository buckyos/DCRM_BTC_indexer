const assert = require('assert');
const { Util } = require('../../util');
const { TokenIndexStorage } = require('../../storage/token');
const constants = require('../../constants');

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
        // check amt is exists and is number
        const content = inscription_item.content;
        assert(content.amt != null, `amt should be exists`);
        assert(_.isNumber(content.amt), `amt should be number`);

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

        if (!_.isNumber(content.amt)) {
            console.error(
                `amt should be number ${inscription_item.inscription_id} ${content.amt}`,
            );

            return {
                ret: 0,
            };
        }

        let amt;
        if (
            content.lucky != null &&
            this._is_lucky_block_mint(inscription_item)
        ) {
            console.log(
                `lucky mint ${inscription_item.inscription_id} ${address} ${content.lucky}`,
            );

            if (content.amt > constants.LUCKY_MINT_MAX_AMOUNT) {
                console.warn(
                    `lucky mint amount is too large ${inscription_item.inscription_id} ${content.amt}`,
                );
                amt = constants.LUCKY_MINT_MAX_AMOUNT;
            } else {
                amt = content.amt;
            }
        } else {
            console.log(
                `mint ${inscription_item.inscription_id} ${address} ${content.amount}`,
            );

            if (content.amt > constants.NORMAL_MINT_MAX_AMOUNT) {
                console.warn(
                    `mint amount is too large ${inscription_item.inscription_id} ${content.amt}`,
                );
                amt = constants.NORMAL_MINT_MAX_AMOUNT;
            } else {
                amt = content.amt;
            }
        }

        // first add mint record
        const { ret: mint_ret } = await this.storage.add_mint_record(
            inscription_item.inscription_id,
            inscription_item.block_height,
            inscription_item.timestamp,
            inscription_item.address,
            amt,
            content.lucky,
        );
        if (mint_ret !== 0) {
            console.error(
                `failed to add mint record ${inscription_item.inscription_id}`,
            );
            return { ret: mint_ret };
        }

        // then update balance for the address
        const { ret } = await this.storage.update_balance(
            inscription_item.address,
            amt,
        );
        if (ret !== 0) {
            console.error(
                `failed to update balance ${inscription_item.inscription_id}`,
            );
            return { ret };
        }

        return { ret: 0 };
    }

    _is_lucky_block_mint(inscription_item) {
        const { block_height, address } = inscription_item;

        // Get the number of the address
        const address_num = Util.address_num(address);

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