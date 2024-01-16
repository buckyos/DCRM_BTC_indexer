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
const moment = require('moment');


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
    console.log(`index version: ${INDEX_VERSION}`);

    // first load config
    const config_path = path.resolve(__dirname, `../config/${config_name}.js`);
    assert(fs.existsSync(config_path), `config file not found: ${config_path}`);
    const config = new Config(config_path);

    // init bug monitor
    const monitor = new BugMonitor(config.config);
    global.bug_monitor = monitor;

    if (argv['reset']) {
        reset(config.config, argv.mode);
        return { ret: 0 };
    }

    return await run_with_lock(config.config, argv.mode);
}

function reset(config, mode) {
    assert(_.isString(mode), `mode should be string, but ${mode}`);

    const now = Date.now();
    if (mode === 'sync' || mode === 'both') {
        reset_sync(config, now);
    }

    if (mode === 'index' || mode === 'both') {
        reset_index(config, now);
    }
}

function get_del_dir(dir, now) {
    assert(_.isString(dir), `dir should be string, but ${dir}`);
    assert(_.isNumber(now), `now should be number, but ${now}`);

    const del_dir = path.join(dir, `del_${moment(now).format('YYYY_MM_DD_HH_mm_ss')}`);
    fs.mkdirSync(del_dir, { recursive: true });
    
    return del_dir;
}

function reset_sync(config, now) {
    const {
        SYNC_STATE_DB_FILE,
        ETH_INDEX_DB_FILE,
        INSCRIPTION_DB_FILE,
        TRANSFER_DB_FILE,
    } = require('./constants');

    // delete all the db files above

    const { ret: get_dir_ret, dir } = Util.get_data_dir(config);
    if (get_dir_ret !== 0) {
        throw new Error(`failed to get data dir`);
    }

    // create tmp dir for delete with current time
    const tmp_dir = get_del_dir(dir, now);

    const sync_state_db_file = path.join(dir, SYNC_STATE_DB_FILE);
    if (fs.existsSync(sync_state_db_file)) {
        console.warn(`remove sync state db: ${sync_state_db_file}`);
        fs.renameSync(sync_state_db_file, path.join(tmp_dir, SYNC_STATE_DB_FILE));
        // fs.unlinkSync(sync_state_db_file);
    }

    const eth_index_db_file = path.join(dir, ETH_INDEX_DB_FILE);
    if (fs.existsSync(eth_index_db_file)) {
        console.warn(`remove eth index db: ${eth_index_db_file}`);
        fs.renameSync(eth_index_db_file, path.join(tmp_dir, ETH_INDEX_DB_FILE));
        // fs.unlinkSync(eth_index_db_file);
    }

    const inscription_db_file = path.join(dir, INSCRIPTION_DB_FILE);
    if (fs.existsSync(inscription_db_file)) {
        console.warn(`remove inscription db: ${inscription_db_file}`);
        fs.renameSync(inscription_db_file, path.join(tmp_dir, INSCRIPTION_DB_FILE));
        // fs.unlinkSync(inscription_db_file);
    }

    const transfer_db_file = path.join(dir, TRANSFER_DB_FILE);
    if (fs.existsSync(transfer_db_file)) {
        console.warn(`remove transfer db: ${transfer_db_file}`);
        fs.renameSync(transfer_db_file, path.join(tmp_dir, TRANSFER_DB_FILE));
        // fs.unlinkSync(transfer_db_file);
    }
}

function reset_index(config, now) {
    const { INDEX_STATE_DB_FILE, TOKEN_INDEX_DB_FILE } = require('./constants');

    const { ret: get_dir_ret, dir } = Util.get_data_dir(config);
    if (get_dir_ret !== 0) {
        throw new Error(`failed to get data dir`);
    }

    const tmp_dir = get_del_dir(dir, now);

    const index_state_db_file = path.join(dir, INDEX_STATE_DB_FILE);
    if (fs.existsSync(index_state_db_file)) {
        console.warn(`remove index state db: ${index_state_db_file}`);
        fs.renameSync(index_state_db_file, path.join(tmp_dir, INDEX_STATE_DB_FILE));
        // fs.unlinkSync(index_state_db_file);
    }

    const token_index_db_file = path.join(dir, TOKEN_INDEX_DB_FILE);
    if (fs.existsSync(token_index_db_file)) {
        console.warn(`remove token index db: ${token_index_db_file}`);
        fs.renameSync(token_index_db_file, path.join(tmp_dir, TOKEN_INDEX_DB_FILE));
        // fs.unlinkSync(token_index_db_file);
    }
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
