const { BTCClient } = require('../btc/btc');
const { OrdClient } = require('../btc/ord');
const { InscriptionIndex } = require('../index/inscription');
const { Util } = require('../util');
const { ETHIndex } = require('../eth/index');
const assert = require('assert');

global._ = require('underscore');

const { Config } = require('../config');

const path = require('path');
const fs = require('fs');

const config_path = path.resolve(__dirname, '../../config/test.js');
assert(fs.existsSync(config_path), `config file not found: ${config_path}`);
const config = new Config(config_path);


async function test_token() {
    const client = new BTCClient(
        config.config.btc.host,
        config.config.btc.network,
        config.config.btc.auth,
    );
    client.get_latest_block_height().then(console.log);
    
    const ordClient = new OrdClient('http://127.0.0.1:80');
    ordClient.get_inscription_by_block(2543908).then(console.log);
    
    const index = new InscriptionIndex(config.config);

    const {ret, tx} = await client.get_transaction('f7aaa9d45e36571f0c2dd19da2276a2267c25e449b35f3f0148eecd8cac9e7bc');
    console.log(tx);
    
    //const eth_index = new ETHIndex(config.config);
    //await index.init(eth_index);
    //index.run().then(console.log);
}

test_token().then(console.log).catch(console.error);

Util.sleep(1000 * 1000);
