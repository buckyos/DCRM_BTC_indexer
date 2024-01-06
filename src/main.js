const assert = require('assert');
const path = require('path');
const fs = require('fs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { InscriptionIndexExecutor } = require('./index/index');
const { TokenIndexExecutor } = require('./token_index/index');
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
        .option('mode', {
            type: 'string',
            demandOption: true,
            describe: 'Mode of operation',
            choices: ['sync', 'index', 'both'],
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

    
    if (argv.mode === 'sync' || argv.mode === 'both') {
        const executor = new InscriptionIndexExecutor(config.config);
        const { ret } = await executor.init();
        if (ret !== 0) {
            console.error(`failed to init inscription index executor`);
            return { ret };
        }
        await executor.run();
    } else if (argv.mode === 'index' || argv.mode === 'both') {
        const executor = new TokenIndexExecutor(config.config);
        const { ret } = await executor.init();
        if (ret !== 0) {
            console.error(`failed to init token index executor`);
            return { ret };
        }
        await executor.run();
    } else {
        console.error(`unknown mode: ${argv.mode}`);
        return { ret: -1 };
    }
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
