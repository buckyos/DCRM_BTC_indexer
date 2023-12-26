const assert = require('assert');
const { TokenIndexStorage } = require('../storage/index');
const constants = require('../constants');

class TokenIndex {
    constructor(config) {
        assert(_.isObject(config), `config should be object`);

        this.config = config;

        const { ret, dir } = Util.get_data_dir(config);
        if (ret !== 0) {
            throw new Error(`failed to get data dir`);
        }

        this.storage = new TokenIndexStorage(dir);
    }

    /**
     *
     * @returns {Promise<{ret: number}>}
     */
    async init() {
        const { ret } = await this.storage.init();
        if (ret !== 0) {
            console.error(`failed to init storage`);
            return { ret };
        }

        console.log(`init TokenIndex success`);
        return { ret: 0 };
    }

    async process_block_inscriptions(block_height, block_inscriptions) {
        assert(_.isNumber(block_height), `block_height should be number`);
        assert(
            _.isArray(block_inscriptions),
            `block_inscriptions should be array`,
        );
        assert(
            block_inscriptions.length > 0,
            `block_inscriptions should not be empty`,
        );

        const { ret: start_ret } = await this.storage.begin_transaction();
        if (start_ret !== 0) {
            console.error(
                `failed to begin transaction at block ${block_height}`,
            );
            return { ret: start_ret };
        }

        let is_failed = false;
        try {
            for (const inscription_item of block_inscriptions) {
                const { ret } = await this.process_inscription(
                    block_height,
                    inscription_item,
                );
                if (ret !== 0) {
                    console.error(
                        `failed to process inscription at block ${block_height} ${inscription_item.inscription_id}`,
                    );
                    is_failed = true;
                    return { ret };
                }
            }
        } catch (error) {
            console.error(
                `failed to process inscription at block ${block_height}`,
                error,
            );
            is_failed = true;
            return { ret: -1 };
        } finally {
            const { ret: commit_ret } = await this.storage.end_transaction(
                !is_failed,
            );
            if (commit_ret !== 0) {
                console.error(
                    `failed to commit transaction at block ${block_height}`,
                );
                return { ret: commit_ret };
            }
        }
    }

    async process_inscription(block_height, inscription_item) {
        assert(_.isNumber(block_height), `block_height should be number`);
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

                // {"p":"brc-20","op":"transfer","tick":"DMC ","amt":"1000",to="DMC Mint Pool Address",call:"pdi-res","ph":"$hash"}
                if (content.call != null ) {
                    // brc-20 transfer with pdi resonance
                    await this.on_transfer_with_resonance(inscription_item);
                } else {
                    // normal brc-20 transfer
                    await this.on_transfer(inscription_item);
                }
                
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
                    ret: -1,
                };
            }
        }

        if (!_.isNumber(content.amt)) {
            console.error(
                `amt should be number ${inscription_item.inscription_id} ${content.amt}`,
            );

            return {
                ret: -1,
            };
        }

        let amt;
        if (
            content.lucky != null &&
            this.is_lucky_block_mint(inscription_item)
        ) {
            console.log(
                `lucky mint ${inscription_item.inscription_id} ${address} ${content.lucky}`,
            );

            if (content.amt > constants.LUCKY_MINT_MAX_AMOUNT) {
                console.warn(
                    `lucky mint amount is too large ${inscription_item.inscription_id} ${content.amt}`,
                );
                amt = constants.MAX_LUCKY_MINT_AMOUNT;
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

    is_lucky_block_mint(inscription_item) {
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

    async on_transfer(inscription_item) {
        const content = inscription_item.content;
        assert(content.to != null, `to should be exists`);
        assert(_.isString(content.to), `to should be string`);

        // check if the address is the same as the output address
        if (inscription_item.address === inscription_item.output_address) {
            console.log(
                `ignore transfer to self ${inscription_item.inscription_id} ${inscription_item.address}`,
            );
            return { ret: 0 };
        }

        const { ret } = await this.storage.transfer(
            inscription_item.address,
            content.to,
            content.amt,
        );
        if (ret !== 0) {
            console.error(
                `failed to transfer ${inscription_item.inscription_id} ${inscription_item.address} ${inscription_item.output_address} ${content.amt}}`,
            );
            return { ret };
        }

        return { ret: 0 };
    }

    async on_deploy(inscription_item) {}

    async on_inscribe(inscription_item) {}

    async on_set_resonance_price(inscription_item) {}

    async on_resonance(inscription_item) {}

    async on_transfer_with_resonance(inscription_item) {}

    async on_chant(inscription_item) {}
}

module.exports = { TokenIndex };
