const { InscriptionTransferMonitor } = require('../index/monitor');
const { Config } = require('../config');
const { OrdClient } = require('../btc/ord');
const assert = require('assert');
const { LogHelper } = require('../log/log');
const moment = require('moment');
const { FixedBlockGenerator, RangeBlockGenerator } = require('./block_generator');

class InscriptionTransferMonitorRunner {
    constructor(config) {
        this.monitor = new InscriptionTransferMonitor(config);
        this.ord_client = new OrdClient(config.ord.rpc_url);
    }

    async init() {
        const { ret } = await this.monitor.init();
        if (ret !== 0) {
            console.error(`failed to init monitor`);
            return { ret };
        }

        console.log(`init monitor success`);
        return { ret: 0 };
    }

    async run(block_generator) {
        let block_height;
        while ((block_height = block_generator.next().value) != null) {
            // calc during time and log
            console.origin.log(`process block ${block_height}`);

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

            // calc during time and log
            const now = Date.now();
            const ts = moment(now).format('YYYY-MM-DD HH:mm:ss.SSS');

            console.origin.log(`process block success ${block_height} ${ts}`);
        }

        return { ret: 0 };
    }

    async _process_block_inscriptions(block_height) {
        assert(block_height != null, `block_height should not be null`);

        const { ret, data: inscriptions } =
            await this.ord_client.get_inscription_by_block(block_height);

        if (ret !== 0) {
            console.error(
                `failed to get inscription by block: ${block_height}`,
            );
            return { ret };
        }

        if (inscriptions.length === 0) {
            console.info(`no inscription in block ${block_height}`);
            return { ret: 0 };
        }

        // process inscriptions in block
        for (let i = 0; i < inscriptions.length; i++) {
            const inscription_id = inscriptions[i];

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

            // get creator address and satpoint
            const {
                ret: get_address_ret,
                satpoint: creator_satpoint,
                address: creator_address,
                value: creator_value,
            } = await this.monitor.calc_create_satpoint(inscription_id);
            if (get_address_ret !== 0) {
                console.error(
                    `failed to get creator address for ${inscription_id}`,
                );
                return { ret: get_address_ret };
            }

            const { ret: add_ret } = await this.monitor.add_new_inscription(
                inscription_id,
                inscription.inscription_number,
                block_height,
                inscription.timestamp,
                creator_address,
                creator_satpoint,
                creator_value,
            );
            if (add_ret !== 0) {
                console.error(
                    `failed to add new inscription creator record ${inscription_id} ${creator_satpoint.to_string()}, ${creator_address}`,
                );
                return { ret: add_ret };
            }
        }

        return { ret: 0 };
    }
}

const path = require('path');
const fs = require('fs');

global._ = require('underscore');

async function test() {
    const config_path = path.resolve(__dirname, '../../config/formal.js');
    assert(fs.existsSync(config_path), `config file not found: ${config_path}`);
    const config = new Config(config_path);

    // init log
    const log = new LogHelper(config.config);
    log.path_console();
    log.enable_console_target(false);

    const runner = new InscriptionTransferMonitorRunner(config.config);
    const { ret: init_ret } = await runner.init();
    if (init_ret !== 0) {
        console.error(`failed to init monitor runner`);
        return { ret: init_ret };
    }

    const block_generator = new FixedBlockGenerator([
        780234, 790355, 790488, 790862, 823382, 823385,
    ]);

    const large_block_generator = new RangeBlockGenerator([780234, 823573]);
    const { ret } = await runner.run(large_block_generator);
    if (ret !== 0) {
        console.error(`failed to run monitor`);
        return { ret };
    }

    return { ret: 0 };
}

test().then(({ ret }) => {
    console.log(`test complete: ${ret}`);
    process.exit(ret);
});
