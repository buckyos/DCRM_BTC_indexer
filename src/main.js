const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { ETHIndex } = require('./eth/index');
const { InscriptionIndex } = require('./index/inscription');
const { Config } = require('./config');
const { LogHelper } = require('./log/log');

global._ = require('underscore');


async function main() {
    // first load config
    const config_path = path.resolve(__dirname, '../config/formal.js');
    assert(fs.existsSync(config_path), `config file not found: ${config_path}`);
    const config = new Config(config_path);

    // init log
    const log = new LogHelper(config.config);
    log.path_console();
    log.enable_console_target(true);

    console.info("test log");

    const eth_index = new ETHIndex(config.config);
    const inscription_index = new InscriptionIndex(config.config);

    // then init eth index
    const { ret: init_eth_index_ret } = await eth_index.init();
    if (init_eth_index_ret !== 0) {
        console.error(`failed to init eth index`);
        return { ret: init_eth_index_ret };
    }

    // then init inscription index
    const { ret: init_inscription_index_ret } = await inscription_index.init(
        eth_index,
    );
    if (init_inscription_index_ret !== 0) {
        console.error(`failed to init inscription index`);
        return { ret: init_inscription_index_ret };
    }

    // run both eth index and inscription index forever
    const eth_index_promise = eth_index.run();
    const inscription_index_promise = inscription_index.run();
    await Promise.all([eth_index_promise, inscription_index_promise]);
}

main()
    .then(({ ret }) => {
        console.log(`run complete: ${ret}`);
        process.exit(ret);
    })
    .catch((err) => {
        console.error(`run failed: ${err}`);
        process.exit(1);
    });
