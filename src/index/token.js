const assert = require('assert');
const { TokenIndexStorage } = require('../storage/index');
const constants = require('../constants');
const { Util } = require('../util');
const { ETHIndex } = require('../eth/index');
const { HashHelper } = require('./ops/hash');
const { InscribeManager } = require('./ops/inscribe');
const { MintManger } = require('./ops/mint');
const { TransferManager } = require('./ops/transfer');

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
     * @param {ETHIndex} eth_index
     * @returns {Promise<{ret: number}>}
     */
    async init(eth_index) {
        assert(eth_index instanceof ETHIndex, `eth_index should be ETHIndex`);
        assert(this.eth_index === undefined, `eth_index should be undefined`);
        this.eth_index = eth_index;
        this.hash_helper = new HashHelper(eth_index);

        const { ret } = await this.storage.init();
        if (ret !== 0) {
            console.error(`failed to init storage`);
            return { ret };
        }

        console.log(`init TokenIndex success`);
        return { ret: 0 };
    }

    async process_block_inscriptions(block_height, block_inscriptions) {
        const block_indexer = new TokenBlockIndex(
            this.storage,
            this.config,
            this.hash_helper,
            block_height,
            block_inscriptions,
        );
        return await block_indexer.process_inscriptions();
    }
}

class TokenBlockIndex {
    constructor(
        storage,
        config,
        hash_helper,
        block_height,
        block_inscriptions,
    ) {
        assert(
            storage instanceof TokenIndexStorage,
            `storage should be TokenIndexStorage`,
        );
        assert(_.isObject(config), `config should be object`);
        assert(
            hash_helper instanceof HashHelper,
            `hash_helper should be HashHelper`,
        );
        assert(_.isNumber(block_height), `block_height should be number`);
        assert(
            _.isArray(block_inscriptions),
            `block_inscriptions should be array`,
        );
        assert(
            block_inscriptions.length > 0,
            `block_inscriptions should not be empty`,
        );

        this.storage = storage;
        this.config = config;
        this.hash_helper = hash_helper;
        this.block_height = block_height;
        this.block_inscriptions = block_inscriptions;

        this.inscribe_manager = new InscribeManager(
            config,
            storage,
            hash_helper,
        );
        this.mint_manager = new MintManger(storage);
        this.transfer_manager = new TransferManager(storage);
    }

    async process_inscriptions() {
        const { ret: start_ret } = await this.storage.begin_transaction();
        if (start_ret !== 0) {
            console.error(
                `failed to begin transaction at block ${this.block_height}`,
            );
            return { ret: start_ret };
        }

        let is_failed = false;
        try {
            for (const inscription_item of this.block_inscriptions) {
                const { ret } = await this.process_inscription(
                    this.block_height,
                    inscription_item,
                );
                if (ret !== 0) {
                    console.error(
                        `failed to process inscription at block ${this.block_height} ${inscription_item.inscription_id}`,
                    );
                    is_failed = true;
                    return { ret };
                }
            }
        } catch (error) {
            console.error(
                `failed to process inscription at block ${this.block_height}`,
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
                    `failed to commit transaction at block ${this.block_height}`,
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
            assert(content.tick === this.config.token.token_name);

            if (content.op === 'mint') {
                await this.on_mint(inscription_item);
            } else if (content.op === 'transfer') {
                // {"p":"brc-20","op":"transfer","tick":"DMC ","amt":"1000",to="DMC Mint Pool Address",call:"pdi-res","ph":"$hash"}
                if (content.call != null) {
                    if (content.call === 'pdi-inscribe') {
                        // brc-20 transfer with pdi inscribe
                        await this.on_transfer_with_inscribe(inscription_item);
                    } else if (content.call === 'pdi-res') {
                    }
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

    // deploy
    async on_deploy(inscription_item) {
        // no need process any more
    }

    // mint
    async on_mint(inscription_item) {
        return await this.mint_manager.on_mint(inscription_item);
    }

    // inscribe
    async on_inscribe(inscription_item) {
        return await this.inscribe_manager.on_inscribe(inscription_item);
    }

    async on_transfer_with_inscribe(inscription_item) {
        return await this.inscribe_manager.on_transfer_with_inscribe(
            inscription_item,
        );
    }

    // transfer
    async on_transfer(inscription_item) {
        return await this.transfer_manager.on_transfer(inscription_item);
    }

    async on_set_resonance_price(inscription_item) {}

    async on_resonance(inscription_item) {}

    async on_transfer_with_resonance(inscription_item) {
        return await this.on_resonance(inscription_item);
    }

    async on_chant(inscription_item) {}
}

module.exports = { TokenIndex };
