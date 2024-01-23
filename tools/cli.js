const axios = require('axios');
const ProgressBar = require('cli-progress');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { Config } = require('../src/config');
const { Util } = require('../src/util');

// create new container
const multi_bar = new ProgressBar.MultiBar(
    {
        clearOnComplete: false,
        hideCursor: true,
        format: '[{name}] [{bar}] | ETA: {eta}s | {local}/{current} | {percent} | {value}/{total}',
    },
    ProgressBar.Presets.shades_grey,
);

const sync_bar = multi_bar.create(100, 0);
const index_bar = multi_bar.create(100, 0);
const eth_bar = multi_bar.create(100, 0);

sync_bar.start(100, 0);
index_bar.start(100, 0);
eth_bar.start(100, 0);

class IndexCli {
    constructor(config) {
        this.config = config;
        this.port = config.interface.port;
        assert(this.port, 'port not set in config');
    }

    async fetch_status() {
        try {
            const response = await axios.get(`http://127.0.0.1:${this.port}/status`);
            return response.data;
        } catch (error) {
            console.error(`failed to fetch status: ${error.code} ${error.cause}`);
        }
    }
    
    update_progress(status) {
        const sync_percent = parseFloat(status.sync.percent);
        const index_percent = parseFloat(status.index.percent);
        const eth_percent = parseFloat(status.eth.percent);
    
        sync_bar.setTotal(status.sync.btc - status.genesis_block_height);
        sync_bar.update(status.sync.local - status.genesis_block_height, {
            name: 'BTC SYNC  ',
            local: status.sync.local,
            current: Math.min(status.sync.btc, status.sync.ord),
            percent: `${sync_percent.toFixed(2)}%`,
        });
        // console.log(`Sync height: ${status.sync.local}`);
    
        index_bar.setTotal(status.index.sync - status.genesis_block_height);
    
        index_bar.update(status.index.local - status.genesis_block_height, {
            name: 'DMCs INDEX',
            local: status.index.local,
            current: status.index.sync,
            percent: `${index_percent.toFixed(2)}%`,
        });
        // console.log(`Index height: ${status.index.local}`);
    
        eth_bar.setTotal(status.eth.eth - status.eth.genesis_block_height);
        eth_bar.update(status.eth.local - status.eth.genesis_block_height, {
            name: 'ETH SYNC  ',
            local: status.eth.local,
            current: status.eth.eth,
            percent: `${eth_percent.toFixed(2)}%`,
        });
    }
    
    async poll() {
        const status = await this.fetch_status();
        if (status) {
            this.update_progress(status);
        }
    }

    start() {
        setInterval(this.poll.bind(this), 1000);
    }
}


const argv = yargs(hideBin(process.argv))
    .option('config', {
        alias: 'c',
        type: 'string',
        description: 'Select the configuration of bitcoin ethereum network',
        choices: Util.get_all_config_names(),
        default: 'formal',
    })
    .help().argv;

const config_name = argv.config;
console.log(`config name: ${config_name}`);

// first load config
const config_path = path.resolve(__dirname, `../config/${config_name}.js`);
assert(fs.existsSync(config_path), `config file not found: ${config_path}`);
const config = new Config(config_path);

const cli = new IndexCli(config.config);
cli.start();
