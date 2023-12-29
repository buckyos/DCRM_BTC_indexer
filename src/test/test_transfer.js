const { InscriptionTransferMonitor } = require('../index/monitor');
const { Config } = require('../config');
const { OrdClient } = require('../btc/ord');
const assert = require('assert');
const { SatPoint } = require('../btc/point');

class BlockGenerator {
    constructor() {
        if (new.target === BlockGenerator) {
            throw new TypeError(
                'Cannot construct BlockGenerator instances directly',
            );
        }
    }

    *generatorFunction() {
        throw new Error('Must override method');
    }

    next() {
        return this.generator.next();
    }
}

class FixedBlockGenerator extends BlockGenerator {
    constructor(blockHeights) {
        super();
        this.blockHeights = blockHeights;
        this.generator = this.generatorFunction();
    }

    *generatorFunction() {
        for (let height of this.blockHeights) {
            yield height;
        }
    }
}

class RangeBlockGenerator extends BlockGenerator {
    constructor(range) {
        super();
        this.range = range;
        this.generator = this.generatorFunction();
    }

    *generatorFunction() {
        for (let i = this.range[0]; i <= this.range[1]; i++) {
            yield i;
        }
    }
}

class InscrtionTransferMonitorRunner {
    constructor(config) {
        this.monitor = new InscriptionTransferMonitor(config);
        this.ord_client = new OrdClient(config.ord.server_url);
    }

    async run(block_generator) {
        let block_height;
        while ((block_height = block_generator.next().value) != null) {
            console.log(`process block ${block_height}`);

            // first process inscriptions in block
            const { ret: process_ret } = await this._process_block_inscriptions(
                block_height,
            );
            if (process_ret !== 0) {
                console.error(`failed to process block inscriptions`);
                return { ret: process_ret };
            }

            // process all tx in block
            const { ret: process_tx_ret } = await this.monitor.process_block(
                block_height,
            );
            if (process_tx_ret !== 0) {
                console.error(`failed to process block tx`);
                return { ret: process_tx_ret };
            }

            console.log(`process block ${block_height} success`);
        }

        return { ret: 0 };
    }

    async _process_block_inscriptions(block_height) {
        assert(block_height != null, `block_height should not be null`);

        const { ret, data } = await this.orc_client.get_inscription_by_block(
            block_height,
        );

        if (ret !== 0) {
            console.error(
                `failed to get inscription by block: ${block_height}`,
            );
            return { ret };
        }

        if (data.inscriptions.length === 0) {
            console.info(`no inscription in block ${block_height}`);
            return { ret: 0 };
        }

        // process inscriptions in block
        for (let i = 0; i < data.inscriptions.length; i++) {
            const inscription_id = data.inscriptions[i];

            // fetch inscription by id
            const { ret: get_ret, inscription } =
                await this.ord_client.get_inscription(inscription_id);
            if (get_ret !== 0) {
                console.error(`failed to get inscription ${inscription_id}`);
                return { ret: get_ret };
            }

            assert(
                inscription.genesis_height === block_height,
                `invalid inscription genesis block height: ${inscription.genesis_height} !== ${block_height}`,
            );

            // get creator address
            const { ret, satpoint } = SatPoint.parse(inscription.satpoint);
            assert(
                ret === 0,
                `failed to parse satpoint: ${inscription.satpoint}`,
            );

            const { ret: get_address_ret, address: creator_address } =
                await this.monitor.utxo_cache.get_uxto(
                    satpoint.outpoint.to_string(),
                );
            if (get_address_ret !== 0) {
                console.error(
                    `failed to get creator address for ${inscription_id} ${satpoint.to_string()}`,
                );
                return { ret: get_address_ret };
            }

            const { ret: add_ret } = this.monitor.add_new_inscription(
                inscription_id,
                block_height,
                inscription.timestamp,
                creator_address,
                inscription.satpoint,
            );
            if (add_ret !== 0) {
                console.error(
                    `failed to add new inscription creator record ${inscription_id} ${satpoint.to_string()}`,
                );
                return { ret: add_ret };
            }
        }

        return { ret: 0 };
    }
}
