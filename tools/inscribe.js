const { Util, BigNumberUtil } = require('../src/util.js');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const {
    DIFFICULTY_INSCRIBE_DATA_HASH_THRESHOLD,
} = require('../src/constants.js');
const assert = require('assert');
const { BTCClient } = require('../src/btc/btc.js');
const moment = require('moment-timezone');
const { Config } = require('../src/config.js');
const path = require('path');
const axios = require('axios');


class InscribeDataLoader {
    constructor() {
        this.url = `
            http://s.dmctech.io/api/pd/list?list_type=balance&uninscribe=false&is_serial=false&sort_type=desc&offset={offset}&length={length}`;
    }

    async load(offset, length) {
        assert(_.isNumber(offset), `offset should be number, but ${offset}`);
        assert(_.isNumber(length), `length should be number, but ${length}`);

        const url = this.url
            .replace('{offset}', offset)
            .replace('{length}', length);
        const response = await axios.get(url);
        const { data } = response;
        if (data.err !== 0) {
            console.error(`failed to get inscribe data list: ${data.msg}`);
            return { ret: data.err };
        }

        assert(_.isArray(data.result.list), `data should be array, but ${data.result}`);
        return { ret: 0, list: data.result.list };
    }
}

class InscribeDataHelper {
    constructor(config) {
        assert(_.isObject(config), `config should be object, but ${config}`);

        this.btc_client = new BTCClient(
            config.btc.host,
            config.btc.network,
            config.btc.auth,
        );

        this.inscribe_data_hash_threshold =
            DIFFICULTY_INSCRIBE_DATA_HASH_THRESHOLD;
        if (config.token.difficulty.inscribe_data_hash_threshold != null) {
            this.inscribe_data_hash_threshold =
                config.token.difficulty.inscribe_data_hash_threshold;
            assert(_.isNumber(this.inscribe_data_hash_threshold));
        }

        this.data_loader = new InscribeDataLoader();
        this.hash_weight_url = `http://127.0.0.1:13001/hash-weight/{hash}?t={timestamp}`;
    }

    convert_timestamp(timestamp) {
        let date = moment.unix(timestamp);
        date.tz(this.timezone);
        return date.format();
    }

    async next_n_inscribe_data(address, n) {
        assert(_.isString(address), `address should be string, but ${address}`);
        assert(_.isNumber(n), `n should be number, but ${n}`);
        assert(n > 0, `n should be greater than 0, but ${n}`);

        let offset = 0;
        let length = 20;
        let total = 0;
        const valid_list = [];

        // eslint-disable-next-line no-constant-condition
        while(true) {
            // load data by page
            const { ret, list } = await this.data_loader.load(offset, length);
            if (ret !== 0) {
                console.error(`failed to load inscribe data list`);
                return { ret };
            }

            if (list.length === 0) {
                console.log(`no more data to load`);
                break;
            }
            total += list.length;

            // check if the data is inscribe valid for address
            for (const item of list) {
                assert(_.isString(item.data_hash), `data_hash should be string, but ${item.data_hash}`);

                const { valid, mixhash } = Util.check_and_fix_mixhash(item.data_hash);
                if (!valid) {
                    console.error(`invalid data_hash: ${item.data_hash}`);
                    return { ret: -1 };
                }

                if (Util.check_inscribe_hash_and_address(mixhash, address, this.inscribe_data_hash_threshold)) {
                    valid_list.push({
                        data_hash: mixhash,
                        origin_data_hash: item.data_hash,
                    });
                }
            }

            if (valid_list.length >= n) {
                break;
            }

            offset += length;
        }

        const timestamp = Math.floor(Date.now() / 1000) - 12;

        let i = 0;
        for (const item of valid_list) {
            const { ret, data } = await this.query_hash_weight(item.data_hash, timestamp);
            if (ret !== 0) {
                console.error(`failed to query hash weight: ${item.data_hash}`);
                return { ret };
            }

            item.index = i++;
            item.point = data.point;
            item.weight = data.weight;
            item.inscribe_cost = BigNumberUtil.multiply(item.weight, 2);
            item.current_max_price = BigNumberUtil.multiply(item.weight, 2);
        }

        return { ret: 0, total, list: valid_list };
    }

    /**
     * @comment query hast weight by hash via `GET 127.0.0.1:13001/hash-weight/${hash}?t=${timestamp}`
     * @param {string} hash
     * @param {number} timestamp
     * @returns {object} { ret, data } 
     */
    async query_hash_weight(hash, timestamp) {
        assert(_.isString(hash), `hash should be string, but ${hash}`);
        assert(_.isNumber(timestamp), `timestamp should be number, but ${timestamp}`);

        const url = this.hash_weight_url
            .replace('{hash}', hash)
            .replace('{timestamp}', timestamp);
        
        try {
            const response = await axios.get(url);
            const { data } = response;
            
            return { ret: 0, data };
        } catch (error) {
            console.error(`failed to query hash weight: ${hash} ${timestamp} ${error}`);
            return { ret: -1 };
        }
    }
}

async function main() {
    const argv = yargs(hideBin(process.argv))
        .option('config', {
            alias: 'c',
            type: 'string',
            description: 'Select the configuration of bitcoin ethereum network',
            choices: ['formal', 'test'],
            default: 'formal',
        })
        .option('address', {
            type: 'string',
            short: 'a',
            demandOption: true,
            describe: 'User btc address',
        })
        .option('n', {
            type: 'number',
            short: 'n',
            demandOption: true,
            describe: 'Number of lucky mint',
            default: 5,
        })
        .help().argv;

    const config_name = argv.config;
    console.log(`config name: ${config_name}`);

    const config_path = path.resolve(__dirname, `../config/${config_name}.js`);
    const config = new Config(config_path);

    const lucky_mint_instance = new InscribeDataHelper(
        config.config,
    );
    const { ret, total, list } = await lucky_mint_instance.next_n_inscribe_data(
        argv.address,
        argv.n,
    );
    if (ret !== 0) {
        console.error(`failed to get next n inscribe data`);
        return { ret };
    }

    console.log(
        `found ${
            list.length
        } inscribe data in ${total} data pool: \n${JSON.stringify(
            list,
            null,
            2,
        )}`,
    );
    return { ret: 0 };
}

global._ = require('underscore');

main()
    .then(({ ret }) => {
        process.exit(ret);
    })
    .catch((error) => {
        console.error(error);
        process.exit(-1);
    });
