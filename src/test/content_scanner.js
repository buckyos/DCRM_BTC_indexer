const {
    FixedBlockGenerator,
    RangeBlockGenerator,
} = require('./block_generator');
const { Config } = require('../config');
const { OrdClient } = require('../btc/ord');
const assert = require('assert');
const moment = require('moment');

const target_content_types = [
    'text/plain;charset=utf-8',
    'text/plain',
    'application/json',
];

class ContentScanner {
    constructor(config) {
        this.config = config;
        this.ord_client = new OrdClient(config.ord.rpc_url);
    }

    async init() {
        return { ret: 0 };
    }

    async scan(block_generator) {
        let block_height;
        while ((block_height = block_generator.next().value) != null) {
            // calc during time and log
            // console.log(`process block ${block_height}`);

            // first process inscriptions in block
            const { ret: process_ret } = await this._process_block_inscriptions(
                block_height,
            );
            if (process_ret !== 0) {
                console.error(`failed to process block inscriptions`);
                return { ret: process_ret };
            }

            // calc during time and log
            const now = Date.now();
            const ts = moment(now).format('YYYY-MM-DD HH:mm:ss.SSS');

            // console.log(`process block success ${block_height} ${ts}`);
        }

        return { ret: 0 };
    }

    async _process_block_inscriptions(block_height) {
        assert(block_height != null, `block_height should not be null`);

        const { ret, data: inscriptions } =
            await this.ord_client.get_inscription_by_block(block_height);

        if (ret !== 0) {
            console.error(
                `failed to get inscription by block: ${block_height}`,
            );
            return { ret };
        }

        if (inscriptions.length === 0) {
            console.info(`no inscription in block ${block_height}`);
            return { ret: 0 };
        }

        // process inscriptions in block
        for (let i = 0; i < inscriptions.length; i++) {
            const inscription_id = inscriptions[i];

            // fetch inscription by id
            const { ret: get_ret, inscription } =
                await this.ord_client.get_inscription(inscription_id);
            if (get_ret !== 0) {
                console.error(`failed to get inscription ${inscription_id}`);
                return { ret: get_ret };
            }

            assert(
                inscription.genesis_height === block_height,
                `invalid inscription genesis block height: ${inscription.genesis_height} !== ${block_height}`,
            );

            // check content type
            if (!this._check_content_type(inscription.content_type)) {
                // console.debug( `skip invalid content type ${inscription.content_type}`,);
                continue;
            }

            // process inscription content
            const { ret: process_ret } =
                await this._process_inscription_content(inscription);
            if (process_ret !== 0) {
                console.error(`failed to process inscription content`);
                return { ret: process_ret };
            }
        }

        return { ret: 0 };
    }

    _check_content_type(content_type) {
        assert(content_type != null, `content_type should not be null`);

        if (content_type === null) {
            // console.debug(`skip empty content type`);
            return false;
        }

        if (content_type.indexOf('html') >= 0) {
            return true;
        }

        if (content_type.indexOf('cbor') >= 0) {
            return true;
        }

        return false;
    }

    async _process_inscription_content(inscription) {
        assert(inscription != null, `inscription should not be null`);

        const { ret, data: content } =
            await this.ord_client.get_content_by_inscription(
                inscription.inscription_id,
            );
        if (ret !== 0 || content == null || !_.isString(content)) {
            console.error(
                `failed to get inscription content ${inscription.id}`,
            );
            return { ret };
        }

        if (
            content.indexOf('src=') >= 0 ||
            content.indexOf('href=') >= 0 ||
            content.indexOf('url(') >= 0 ||
            content.indexOf('url (') >= 0
        ) {
            console.log(
                `got target content with ref ${inscription.inscription_id}, ${inscription.content_type}`,
            );
        }

        if (content.indexOf('<img') >= 0 ) {
            console.log(
                `got target content with img ${inscription.inscription_id}, ${inscription.content_type}`,
            );
        }

        //console.log(
        //    `got target content ${inscription.inscription_id}, ${inscription.content_type}`,
        //);

        return { ret: 0 };
    }
}

const path = require('path');
const fs = require('fs');

global._ = require('underscore');

async function test() {
    const config_path = path.resolve(__dirname, '../../config/formal.js');
    assert(fs.existsSync(config_path), `config file not found: ${config_path}`);
    const config = new Config(config_path);

    const runner = new ContentScanner(config.config);
    const { ret: init_ret } = await runner.init();
    if (init_ret !== 0) {
        console.error(`failed to init monitor runner`);
        return { ret: init_ret };
    }

    const large_block_generator = new RangeBlockGenerator([780234, 9999999]);
    const { ret } = await runner.scan(large_block_generator);
    if (ret !== 0) {
        console.error(`failed to run content scanner`);
        return { ret };
    }

    return { ret: 0 };
}

test().then(({ ret }) => {
    console.log(`test complete: ${ret}`);
    process.exit(ret);
});
