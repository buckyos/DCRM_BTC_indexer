const assert = require('assert');
const path = require('path');
const fs = require('fs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { ETHIndex } = require('./eth/index');
const { InscriptionIndex } = require('./index/inscription');
const { Config } = require('./config');
const { LogHelper } = require('./log/log');

global._ = require('underscore');

async function main() {
    // first parse args
    
    const argv = yargs(hideBin(process.argv))
        .option('config', {
            alias: 'c',
            type: 'string',
            description: 'Select the configuration of bitcoin ethereum network',
            choices: ['formal', 'test'],
            default: 'formal',
        })
        .help().argv;
    const config_name = argv.config;
    console.log(`config name: ${config_name}`);

    // first load config
    const config_path = path.resolve(__dirname, `../config/${config_name}.js`);
    assert(fs.existsSync(config_path), `config file not found: ${config_path}`);
    const config = new Config(config_path);

    // init log
    const log = new LogHelper(config.config);
    log.path_console();
    log.enable_console_target(true);
    log.set_level('info');

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
        console.error(`run failed: ${err}, ${err.stack}`);
        process.exit(1);
    });
