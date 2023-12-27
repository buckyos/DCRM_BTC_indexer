const { BTCClient } = require('../btc/btc');
const { OrdClient } = require('../btc/ord');
const { InscriptionIndex } = require('../index/inscription');
const { Util } = require('../util');
const { ETHIndex } = require('../eth/index');

global._ = require('underscore');

const { Config } = require('../config');

const path = require('path');
const fs = require('fs');

const { assert } = require('console');
const config_path = path.resolve(__dirname, '../../config.js');
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
    index.run().then(console.log);
}

async function test_eth() {
    const client = new ETHIndex(config.config);
    await client.init();

    {
        const {ret: ret1, block_height: block_height1} = await client.storage.query_block_with_timestamp(1439800483);
        assert(ret1 === 0);
        assert(block_height1 === 100091);

        const {ret: ret2, block_height: block_height2} = await client.storage.query_block_with_timestamp(1439800482);
        assert(ret1 === 0);
        assert(block_height2 === 100090);

        const {ret: ret3, block_height: block_height3} = await client.storage.query_block_with_timestamp(1439800484);
        assert(ret1 === 0);
        assert(block_height3 === 100092);

        // test last block
        /*
        const {ret: ret4, block_height: block_height4} = await client.storage.query_block_with_timestamp(1439800540);
        assert(ret1 === 0);
        assert(block_height4 == null);
        */
    }

    {   
        const hash = "0x80000000059671f61d06b37cf3769b5a35548d4db9496aed632b876e40469bdd";
        let data_size;
        let method;
        try {
            const ret = Util.decode_mixhash(hash);
            data_size = ret.size;
            method = ret.method;
        } catch (error) {
            console.error(`failed to decode hash ${hash}: ${error}`);
            assert(false);
        }

        assert(method === 2, `method should be 2, but ${method}`);
        assert(data_size === 93745654, `data size should be 93745654, but ${data_size}`);
    }

    await client.query_hash_point(1439800483, "0x80000000059671f61d06b37cf3769b5a35548d4db9496aed632b876e40469bdd");

    await client.run();
}

test_token().then(console.log).catch(console.error);

Util.sleep(1000 * 1000);
