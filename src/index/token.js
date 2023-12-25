const assert = require('assert');

class TokenIndex {
    constructor(config) {
        assert(_.isObject(config), `config should be object`);

        this.config = config;
    }

    async process_inscription(inscription_item) {
        assert(
            _.isObject(inscription_item),
            `inscription_item should be object`,
        );
        assert(
            _.isObject(inscription_item.content),
            `inscription content should be object`,
        );

        const content = inscription_item.content;
        if (content.p === 'brc-20') {
            assert(content.tick === this.config.token_name);

            if (content.op === 'mint') {
                await this.on_mint(inscription_item);
            } else if (content.op === 'transfer') {
                await this.on_transfer(inscription_item);
            } else if (content.op === 'deploy') {
                await this.on_deploy(inscription_item);
            } else {
                console.error(
                    `unknown operation ${inscription_item.inscription_id} ${content.op}`,
                );
            }
        } else if (content.p === 'pdi') {
            if (content.op === 'inscribe') {
                await this.on_inscribe(inscription_item);
            } else if (content.op === 'set') {
                await this.on_set_resonance_price(inscription_item);
            } else if (content.op === 'res') {
                await this.on_resonance(inscription_item);
            } else if (content.op === 'chant') {
                await this.on_chant(inscription_item);
            } else {
                console.error(
                    `unknown operation ${inscription_item.inscription_id} ${content.op}`,
                );
            }
        } else {
            console.error(
                `unknown protocol ${inscription_item.inscription_id} ${content.p}`,
            );
        }
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
                    ret: -1
                };
            }
        }

        if (!_.isNumber(content.amt)) {
            console.error(
                `amt should be number ${inscription_item.inscription_id} ${content.amt}`,
            );

            return {
                ret: -1
            };
        }
        
        if (content.lucky != null && this.is_lucky_block_mint(inscription_item)) {
            console.log(
                `lucky mint ${inscription_item.inscription_id} ${address} ${content.lucky}`,
            );
        } else {
            console.log(
                `mint ${inscription_item.inscription_id} ${address} ${content.amount}`,
            );
        }
    }

    is_lucky_block_mint(inscription_item) {
        const { block_height, address } = inscription_item;

        // Get the ASCII value of the last character of the address
        const asciiValue = address.charCodeAt(address.length - 1);

        // Check if the sum of the block height and the ASCII value is divisible by 64
        if ((block_height + asciiValue) % 64 === 0) {
            // Special handling for this inscription_item
            return true;
        } else {
            // Normal handling for this inscription_item
            return false;
        }
    }

    async on_transfer(inscription_item) {}

    async on_deploy(inscription_item) {}

    async on_inscribe(inscription_item) {}

    async on_set_resonance_price(inscription_item) {}

    async on_resonance(inscription_item) {}

    async on_chant(inscription_item) {}
}
