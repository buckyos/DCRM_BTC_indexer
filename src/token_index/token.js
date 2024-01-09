const assert = require('assert');
const { TokenIndexStorage } = require('../storage/token');
const { Util } = require('../util');
const { ETHIndex } = require('../eth/index');
const { HashHelper } = require('./ops/hash');
const { InscribeDataOperator } = require('./ops/inscribe');
const { MintOperator } = require('./ops/mint');
const { TransferOperator } = require('./ops/transfer');
const { ChantOperator } = require('./ops/chant');
const { ResonanceOperator } = require('./ops/resonance');
const { SetPriceOperator } = require('./ops/set_price');
const { BlockInscriptionCollector, InscriptionOp } = require('../index/item');

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

    async process_block_inscriptions(block_height, block_collector) {
        assert(_.isNumber(block_height), `block_height should be number`);
        assert(
            block_collector instanceof BlockInscriptionCollector,
            `block_collector should be BlockInscriptionCollector`,
        );

        const block_indexer = new TokenBlockIndex(
            this.storage,
            this.config,
            this.hash_helper,
            block_height,
            block_collector,
            this.eth_index,
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
        block_collector,
        eth_index,
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
            block_collector instanceof BlockInscriptionCollector,
            `block_collector should be BlockInscriptionCollector`,
        );
        assert(eth_index instanceof ETHIndex, `eth_index should be ETHIndex`);

        this.storage = storage;
        this.config = config;
        this.hash_helper = hash_helper;
        this.block_height = block_height;
        this.block_collector = block_collector;
        this.eth_index = eth_index;

        this.inscribe_operator = new InscribeDataOperator(
            config,
            storage,
            hash_helper,
        );
        this.mint_operator = new MintOperator(config, storage, eth_index);
        this.transfer_operator = new TransferOperator(storage);
        this.chant_operator = new ChantOperator(config, storage, hash_helper);
        this.resonance_operator = new ResonanceOperator(
            config,
            storage,
            hash_helper,
        );
        this.set_price_operator = new SetPriceOperator(storage, hash_helper);
    }

    async process_inscriptions() {
        const { ret: start_ret } = await this.storage.begin_transaction();
        if (start_ret !== 0) {
            console.error(
                `failed to begin transaction at block ${this.block_height}`,
            );
            return { ret: start_ret };
        }

        let process_result = 0;
        try {
            const { ret } = await this._process_inscriptions();
            process_result = ret;
        } catch (error) {
            console.error(
                `failed to process inscription at block ${this.block_height}`,
                error,
                error.stack,
            );
            process_result = -1;

            // report bug if global bug monitor is set
            if (global.bug_monitor) {
                global.bug_monitor.report(error);
            }
        } finally {
            const is_success = process_result === 0;

            const { ret: commit_ret } = await this.storage.end_transaction(
                is_success,
            );
            if (commit_ret !== 0) {
                console.error(
                    `failed to commit transaction at block ${this.block_height}`,
                );
                process_result = commit_ret;
            }

            if (is_success) {
                console.log(
                    `processed block ${this.block_height} inscriptions success`,
                );
            } else {
                console.error(
                    `processed block ${this.block_height} inscriptions failed`,
                );
            }
        }

        return { ret: process_result };
    }

    async _process_inscriptions() {
        assert(this.block_collector != null, `block_collector should be set`);

        // process new inscriptions
        for (const inscription_item of this.block_collector.new_inscriptions) {
            console.log(
                `will process new inscription ${inscription_item.inscription_id} ${inscription_item.op.op}`,
            );

            if (inscription_item.op.op === InscriptionOp.Mint) {
                const { ret } = await this.on_mint(inscription_item);
                if (ret !== 0) {
                    console.error(
                        `failed to mint at block ${this.block_height} ${inscription_item.inscription_id}`,
                    );

                    return { ret };
                }
            } else if (inscription_item.op.op === InscriptionOp.Inscribe) {
                const { ret } = await this.on_inscribe_data(inscription_item);
                if (ret !== 0) {
                    console.error(
                        `failed to inscribe data at block ${this.block_height} ${inscription_item.inscription_id}`,
                    );

                    return { ret };
                }
            } else if (inscription_item.op.op === InscriptionOp.SetPrice) {
                const { ret } = await this.on_set_resonance_price(
                    inscription_item,
                );
                if (ret !== 0) {
                    console.error(
                        `failed to set price at block ${this.block_height} ${inscription_item.inscription_id}`,
                    );

                    return { ret };
                }
            } else if (inscription_item.op.op === InscriptionOp.Chant) {
                const { ret } = await this.on_chant(inscription_item);
                if (ret !== 0) {
                    console.error(
                        `failed to chant at block ${this.block_height} ${inscription_item.inscription_id}`,
                    );

                    return { ret };
                }
            } else if (inscription_item.op.op === InscriptionOp.Resonance) {
                const { ret } = await this.on_inscribe_resonance(
                    inscription_item,
                );
                if (ret !== 0) {
                    console.error(
                        `failed to inscribe resonance at block ${this.block_height} ${inscription_item.inscription_id}`,
                    );

                    return { ret };
                }
            } else if (inscription_item.op.op === InscriptionOp.Transfer) {
                const { ret } = await this.on_inscribe_transfer(
                    inscription_item,
                );
                if (ret !== 0) {
                    console.error(
                        `failed to transfer at block ${this.block_height} ${inscription_item.inscription_id}`,
                    );

                    return { ret };
                }
            } else {
                console.error(
                    `unknown inscription op ${inscription_item.op.op}`,
                );
            }
        }

        // process transfer inscriptions
        for (const inscription_transfer_item of this.block_collector
            .inscription_transfers) {

            console.log(
                `will process transfer inscription ${inscription_transfer_item.inscription_id} ${inscription_transfer_item.op.op}`,
            );

            if (inscription_transfer_item.op.op === InscriptionOp.Mint) {
                console.warn(
                    `mint op should not be transferred ${inscription_transfer_item.inscription_id}`,
                );
            } else if (
                inscription_transfer_item.op.op === InscriptionOp.Inscribe
            ) {
                const { ret } = await this.on_inscribe_data_transfer(
                    inscription_transfer_item,
                );
                if (ret !== 0) {
                    console.error(
                        `failed to inscribe data transfer at block ${this.block_height} ${inscription_transfer_item.inscription_id}`,
                    );

                    return { ret };
                }
            } else if (
                inscription_transfer_item.op.op === InscriptionOp.SetPrice
            ) {
                console.warn(
                    `set price op should not be transferred ${inscription_transfer_item.inscription_id}`,
                );
            } else if (
                inscription_transfer_item.op.op === InscriptionOp.Chant
            ) {
                console.warn(
                    `chant op should not be transferred ${inscription_transfer_item.inscription_id}`,
                );
            } else if (
                inscription_transfer_item.op.op ===
                InscriptionOp.Resonance
            ) {
                const { ret } = await this.on_transfer_resonance(
                    inscription_transfer_item,
                );
                if (ret !== 0) {
                    console.error(
                        `failed to transfer resonance at block ${this.block_height} ${inscription_transfer_item.inscription_id}`,
                    );

                    return { ret };
                }
            } else if (
                inscription_transfer_item.op.op === InscriptionOp.Transfer
            ) {
                const { ret } = await this.on_transfer(
                    inscription_transfer_item,
                );
                if (ret !== 0) {
                    console.error(
                        `failed to transfer at block ${this.block_height} ${inscription_transfer_item.inscription_id}`,
                    );

                    return { ret };
                }
            } else {
                console.error(
                    `unknown inscription op ${inscription_transfer_item.op.op}`,
                );
            }
        }

        // process pending ops
        const { ret: inscribe_ret } =
            await this.inscribe_operator.process_pending_inscribe_ops();
        if (inscribe_ret !== 0) {
            console.error(
                `failed to process pending inscribe ops at block ${this.block_height}`,
            );

            return { ret: inscribe_ret };
        }

        const { ret: resonance_ret } =
            await this.resonance_operator.process_pending_resonance_ops();
        if (resonance_ret !== 0) {
            console.error(
                `failed to process pending resonance ops at block ${this.block_height}`,
            );

            return { ret: resonance_ret };
        }

        return { ret: 0 };
    }

    // deploy
    async on_deploy(inscription_item) {
        console.log(`on_deploy ${inscription_item.inscription_id}`);

        // no need process any more
    }

    // mint
    async on_mint(inscription_item) {
        return await this.mint_operator.on_mint(inscription_item);
    }

    // inscribe data
    async on_inscribe_data(inscription_item) {
        return await this.inscribe_operator.on_inscribe(inscription_item);
    }

    // inscribe data's transfer
    async on_inscribe_data_transfer(inscription_transfer_item) {
        return await this.inscribe_operator.on_transfer(
            inscription_transfer_item,
        );
    }

    // transfer
    async on_inscribe_transfer(inscription_item) {
        return await this.transfer_operator.on_inscribe(inscription_item);
    }

    async on_transfer(inscription_item) {
        return await this.transfer_operator.on_transfer(inscription_item);
    }

    // set resonance price
    async on_set_resonance_price(inscription_item) {
        return await this.set_price_operator.on_set_price(inscription_item);
    }

    // resonance
    async on_inscribe_resonance(inscription_item) {
        return await this.resonance_operator.on_inscribe(inscription_item);
    }

    async on_transfer_resonance(inscription_transfer_item) {
        return await this.resonance_operator.on_transfer(
            inscription_transfer_item,
        );
    }

    // chant
    async on_chant(inscription_item) {
        return await this.chant_operator.on_chant(inscription_item);
    }
}

module.exports = { TokenIndex };
