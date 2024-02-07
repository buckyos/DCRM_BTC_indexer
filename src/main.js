const assert = require('assert');
const path = require('path');
const fs = require('fs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { InscriptionIndexExecutor } = require('./index/index');
const { TokenIndexExecutor } = require('./token_index/index');
const { Config } = require('./config');
const { LogHelper } = require('./log/log');
const lockfile = require('proper-lockfile');
const { Util } = require('./util');
const { IndexLocalInterface } = require('./interface/local');
const { BugMonitor } = require('./debug/monitor');
const { INDEX_VERSION } = require('./constants');
const { ResetManager, ChainType } = require('./reset');

global._ = require('underscore');



async function main() {
    // first scan config dir for all config names
    const config_names = Util.get_all_config_names();

    // first parse args

    const argv = yargs(hideBin(process.argv))
        .option('config', {
            alias: 'c',
            type: 'string',
            description: 'Select the configuration of bitcoin ethereum network',
            choices: config_names,
            default: 'formal',
        })
        .option('mode', {
            type: 'string',
            demandOption: true,
            describe: 'Mode of operation',
            choices: ['sync', 'index', 'both'],
        })
        .option('reset', {
            alias: 'r',
            type: 'boolean',
            describe: 'Reset state and all data, base on mode',
        })
        .option('eth', {
            type: 'boolean',
            describe: 'Only reset ethereum network state',
        })
        .option('btc', {    
            type: 'boolean',
            describe: 'Only reset bitcoin network state',
        })
        .help().argv;

    const config_name = argv.config;
    console.log(`config name: ${config_name}`);
    console.log(`index version: ${INDEX_VERSION}`);

    // first load config
    const config_path = path.resolve(__dirname, `../config/${config_name}.js`);
    assert(fs.existsSync(config_path), `config file not found: ${config_path}`);
    const config = new Config(config_path);

    // init bug monitor
    const monitor = new BugMonitor(config.config);
    global.bug_monitor = monitor;

    if (argv['reset']) {

        let chain_type = ChainType.Both;
        if (argv['eth'] && !argv['btc']) {
            chain_type = ChainType.ETH;
        } else if (!argv['eth'] && argv['btc']) {
            chain_type = ChainType.BTC;
        } else if (argv['eth'] && argv['btc']) {
            throw new Error(`invalid reset option: eth and btc`);
        }

        await reset(config.config, argv.mode, chain_type);
        return { ret: 0 };
    }

    return await run_with_lock(config.config, argv.mode);
}

async function reset(config, mode, chain_type) {
    const reset_manager = new ResetManager(config);
    await reset_manager.reset(mode, chain_type);
}

async function run(config, mode) {
    assert(_.isString(mode), `mode should be string, but ${mode}`);

    // init log
    new LogHelper(config);

    if (global.bug_monitor) {
        const error_fn = console.error;
        console.error = function (...args) {
            global.bug_monitor.report(new Error(JSON.stringify(args)));
            error_fn(...args);
        };
    }

    const promise_list = [];
    if (mode === 'sync' || mode === 'both') {
        const executor = new InscriptionIndexExecutor(config);
        const { ret } = await executor.init();
        if (ret !== 0) {
            console.error(`failed to init inscription index executor`);
            return { ret };
        }

        promise_list.push(executor.run());
    }

    if (mode === 'index' || mode === 'both') {
        const executor = new TokenIndexExecutor(config);
        const { ret } = await executor.init();
        if (ret !== 0) {
            console.error(`failed to init token index executor`);
            return { ret };
        }

        const server = new IndexLocalInterface(config, executor);
        const { ret: server_ret } = await server.start();
        if (server_ret !== 0) {
            console.error(`failed to start local interface`);
            return { ret: server_ret };
        }

        promise_list.push(executor.run());
    }

    assert(promise_list.length > 0);
    const ret_list = await Promise.all(promise_list);
    for (const ret of ret_list) {
        if (ret !== 0) {
            console.error(`failed to run executor`);
            return { ret };
        }
    }

    console.log(`run complete`);
    return { ret: 0 };
}

async function run_with_lock(config, mode) {
    const { ret: get_dir_ret, dir } = Util.get_data_dir(config);
    if (get_dir_ret !== 0) {
        throw new Error(`failed to get data dir`);
    }

    const lock_dir = path.join(dir, 'lock');
    if (!fs.existsSync(lock_dir)) {
        fs.mkdirSync(lock_dir, { recursive: true });
    }

    let sync_release;
    if (mode === 'sync' || mode === 'both') {
        const lock_file = path.join(lock_dir, `sync.lock`);
        fs.closeSync(fs.openSync(lock_file, 'w'));

        try {
            sync_release = lockfile.lockSync(lock_file);
        } catch (error) {
            console.error(`failed to lock sync file: ${lock_file} ${error}`);
            return { ret: -1 };
        }
    }

    let index_release;
    if (mode === 'index' || mode === 'both') {
        const lock_file = path.join(lock_dir, `index.lock`);
        fs.closeSync(fs.openSync(lock_file, 'w'));

        try {
            index_release = lockfile.lockSync(lock_file);
        } catch (error) {
            console.error(`failed to lock index file: ${lock_file} ${error}`);
            return { ret: -1 };
        }
    }

    let ret;
    try {
        ret = await run(config, mode);
    } catch (error) {
        console.error(`failed to run: ${error}, ${error.stack}`);
        ret = { ret: -1 };
    } finally {
        if (sync_release) {
            sync_release();
        }

        if (index_release) {
            index_release();
        }
    }

    return ret;
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
