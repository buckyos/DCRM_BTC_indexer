const { BTCClient } = require('../btc/btc');
const { OrdClient } = require('../btc/ord');
const { InscriptionIndex } = require('../index/inscription');

global._ = require('underscore');

const { Config } = require('../config');

const path = require('path');
const fs = require('fs');

const { assert } = require('console');
const config_path = path.resolve(__dirname, '../../config.js');
assert(fs.existsSync(config_path), `config file not found: ${config_path}`);
const config = new Config(config_path);

const client = new BTCClient(
    config.config.btc.host,
    config.config.btc.network,
    config.config.btc.auth,
);
client.get_latest_block_height().then(console.log);

const ordClient = new OrdClient('http://127.0.0.1:80');
ordClient.get_inscription_by_block(2543908).then(console.log);

const index = new InscriptionIndex(config.config);
index.run().then(console.log);
