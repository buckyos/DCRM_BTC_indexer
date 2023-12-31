const {
    InscriptionNewItem,
    InscriptionContentLoader,
    BlockInscriptionCollector,
} = require('../index/item');
const { InscriptionTransferItem } = require('../index/item');
const { SatPoint } = require('../btc/point');
const assert = require('assert');
const { TokenIndex } = require('../index/token');
const { ETHIndex } = require('../eth/index');
const { Config } = require('../config');
const { Util } = require('../util');

class InscribeDataOpGenerator {
    constructor(address) {
        this.address = address;
    }

    // gen hash 32bytes len with random data, in hex code string
    /**
     *
     * @returns {string}
     */
    gen_random_hash() {
        const len = 32;
        const buf = Buffer.alloc(len);
        for (let i = 0; i < len; ++i) {
            buf[i] = Math.floor(Math.random() * 256);
        }

        return buf.toString('hex');
    }

    // (txid - hash) % 32 == 0
    gen_random_hash_with_check_valid(txid) {
        assert(_.isString(txid), `invalid txid ${txid}`);

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const hash = this.gen_random_hash();

            if (Util.check_inscribe_hash_and_address(hash, txid, 32)) {
                return hash;
            }
        }
    }

    gen_content(commit_txid) {
        const content = {
            p: 'pdi',
            op: 'inscribe',
            ph: this.gen_random_hash_with_check_valid(commit_txid),
            text: 'inscribe_data_1',
            amt: '1000',
            price: '100',
        };

        return content;
    }
}

class TestInscriptionsGenerator {
    constructor(config) {
        assert(_.isObject(config), `invalid config`);
        this.config = config;
    }

    // gen some random inscriptions
    gen() {
        const block_collector = new BlockInscriptionCollector(100);

        const { satpoint } = SatPoint.parse('100000:0:0');
        const inscribe_data_content1 = {
            p: 'pdi',
            op: 'inscribe',
            ph: this.gen_random_hash('000000'),
            text: 'inscribe_data_1',
            amt: '1000',
            price: '100',
        };

        const { item: inscribe_data_op1 } =
            InscriptionContentLoader.parse_content(
                '1',
                inscribe_data_content1,
                this.config,
            );

        // block 100
        const inscribe_data_1 = new InscriptionNewItem(
            '1', // inscription_id
            1, // inscription_number
            100, // block_height
            100, // block_time
            'address1', // address
            satpoint, // satpoint
            5, // value
            inscribe_data_content1, // content
            inscribe_data_op1, // op
            '99999',
        );

        const inscribe_data_content2 = {
            p: 'pdi',
            op: 'inscribe',
            ph: this.gen_random_hash('0000001'),
            text: 'inscribe_data_2',
            amt: '1000',
            price: '100',
        };

        const { item: inscribe_data_op2 } =
            InscriptionContentLoader.parse_content(
                '2',
                inscribe_data_content2,
                this.config,
            );

        const inscribe_data_2 = new InscriptionNewItem(
            '2', // inscription_id
            2, // inscription_number
            100, // block_height
            100, // block_time
            'address2', // address
            satpoint, // satpoint
            5, // value
            inscribe_data_content2, // content
            inscribe_data_op2, // op
            '99998',
        );

        block_collector.add_new_inscription(inscribe_data_1);
        block_collector.add_new_inscription(inscribe_data_2);

        return block_collector;
    }
}

class TestTokenIndex {
    constructor(config) {
        assert(_.isObject(config), `invalid config`);
        this.config = config;
    }

    async run() {
        const eth_index = new ETHIndex(this.config);

        // first init eth index
        const { ret: init_eth_index_ret } = await eth_index.init();
        if (init_eth_index_ret !== 0) {
            console.error(`failed to init eth index`);
            return { ret: init_eth_index_ret };
        }

        const token_index = new TokenIndex(this.config);
        const { ret: init_token_index_ret } = await token_index.init(eth_index);
        if (init_token_index_ret !== 0) {
            console.error(`failed to init token index`);
            return { ret: init_token_index_ret };
        }

        const block_collector = new TestInscriptionsGenerator(
            this.config,
        ).gen();

        const { ret } = await token_index.process_block_inscriptions(
            100,
            block_collector,
        );
        if (ret !== 0) {
            console.error(`failed to process block inscriptions`);
            return { ret };
        }

        return { ret: 0 };
    }
}

const path = require('path');
const fs = require('fs');
global._ = require('underscore');
const { LogHelper } = require('../log/log');

async function test() {
    const config_path = path.resolve(__dirname, '../../config/formal.js');
    assert(fs.existsSync(config_path), `config file not found: ${config_path}`);
    const config = new Config(config_path);

    // init log
    const log = new LogHelper(config.config);
    log.path_console();
    log.enable_console_target(true);

    const runner = new TestTokenIndex(config.config);
    return await runner.run();
}

test().then(({ ret }) => {
    console.log(`test complete: ${ret}`);
    process.exit(ret);
});
