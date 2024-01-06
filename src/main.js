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
        .option('reset', {
            alias: 'r',
            type: 'boolean',
            describe: 'Reset state and all data, base on mode',
        })
        .help().argv;

    const config_name = argv.config;
    console.log(`config name: ${config_name}`);

    // first load config
    const config_path = path.resolve(__dirname, `../config/${config_name}.js`);
    assert(fs.existsSync(config_path), `config file not found: ${config_path}`);
    const config = new Config(config_path);

    if (argv['reset']) {
        reset(config.config, argv.mode);
        return { ret: 0 };
    }

    return await run_with_lock(config.config, argv.mode);
}

function reset(config, mode) {
    assert(_.isString(mode), `mode should be string, but ${mode}`);

    if (mode === 'sync' || mode === 'both') {
        reset_sync(config);
    }

    if (mode === 'index' || mode === 'both') {
        reset_index(config);
    }
}

function reset_sync(config) {
    const {SYNC_STATE_DB_FILE, ETH_INDEX_DB_FILE, INSCRIPTION_DB_FILE, TRANSFER_DB_FILE } = require('./constants');

    // delete all the db files above

    const { ret: get_dir_ret, dir } = Util.get_data_dir(config);
    if (get_dir_ret !== 0) {
        throw new Error(`failed to get data dir`);
    }

    const sync_state_db_file = path.join(dir, SYNC_STATE_DB_FILE);
    if (fs.existsSync(sync_state_db_file)) {
        console.warn(`remove sync state db: ${sync_state_db_file}`);
        fs.unlinkSync(sync_state_db_file);
    }

    const eth_index_db_file = path.join(dir, ETH_INDEX_DB_FILE);
    if (fs.existsSync(eth_index_db_file)) {
        console.warn(`remove eth index db: ${eth_index_db_file}`);
        fs.unlinkSync(eth_index_db_file);
    }

    const inscription_db_file = path.join(dir, INSCRIPTION_DB_FILE);
    if (fs.existsSync(inscription_db_file)) {
        console.warn(`remove inscription db: ${inscription_db_file}`);
        fs.unlinkSync(inscription_db_file);
    }

    const transfer_db_file = path.join(dir, TRANSFER_DB_FILE);
    if (fs.existsSync(transfer_db_file)) {
        console.warn(`remove transfer db: ${transfer_db_file}`);
        fs.unlinkSync(transfer_db_file);
    }
}

function reset_index(config) {
    const {INDEX_STATE_DB_FILE, TOKEN_INDEX_DB_FILE} = require('./constants');

    const { ret: get_dir_ret, dir } = Util.get_data_dir(config);
    if (get_dir_ret !== 0) {
        throw new Error(`failed to get data dir`);
    }

    const index_state_db_file = path.join(dir, INDEX_STATE_DB_FILE);
    if (fs.existsSync(index_state_db_file)) {
        console.warn(`remove index state db: ${index_state_db_file}`);
        fs.unlinkSync(index_state_db_file);
    }

    const token_index_db_file = path.join(dir, TOKEN_INDEX_DB_FILE);
    if (fs.existsSync(token_index_db_file)) {
        console.warn(`remove token index db: ${token_index_db_file}`);
        fs.unlinkSync(token_index_db_file);
    }
}

async function run(config, mode) {
    assert(_.isString(mode), `mode should be string, but ${mode}`);

    // init log
    const log = new LogHelper(config);
    log.path_console();
    log.enable_console_target(true);
    log.set_level('info');

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
