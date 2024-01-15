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

const config_path = path.resolve(__dirname, '../../config/formal.js');
assert(fs.existsSync(config_path), `config file not found: ${config_path}`);
const config = new Config(config_path);

const fetch = require('node-fetch');

async function fetch_data(inscription_id) {
    const url = `${config.config.ord.rpc_url}/content/${inscription_id}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.text();  // 或者使用 response.json() 如果你知道响应是 JSON 格式
        console.log(data);
    } catch (error) {
        console.log('There has been a problem with your fetch operation: ', error.message);
    }
}

async function test_token() {
    const client = new BTCClient(
        config.config.btc.host,
        config.config.btc.network,
        config.config.btc.auth,
    );
    client.get_latest_block_height().then(console.log);
    
    const ordClient = new OrdClient(config.config.ord.rpc_url);
    ordClient.get_inscription_by_block(2543908).then(console.log);
    
    await fetch_data("bd7d46310b3354b35b4362e9efdc5966d64e5d2cc228f568dc6d5eea79c3d278i0");
    const ret1 = await ordClient.get_content_by_inscription("bd7d46310b3354b35b4362e9efdc5966d64e5d2cc228f568dc6d5eea79c3d278i0");

    const index = new InscriptionIndex(config.config);

    const {ret, tx} = await client.get_transaction('f7aaa9d45e36571f0c2dd19da2276a2267c25e449b35f3f0148eecd8cac9e7bc');
    console.log(tx);

    //const eth_index = new ETHIndex(config.config);
    //await index.init(eth_index);
    //index.run().then(console.log);
}

test_token().then(console.log).catch(console.error);

Util.sleep(1000 * 1000);
