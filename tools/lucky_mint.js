const { Util } = require('../src/util.js');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const {
    DIFFICULTY_INSCRIBE_LUCKY_MINT_BLOCK_THRESHOLD,
} = require('../src/constants.js');
const assert = require('assert');
const { BTCClient } = require('../src/btc/btc.js');
const moment = require('moment-timezone');
const { Config } = require('../src/config.js');
const path = require('path');

class LuckyMintHelper {
    constructor(config, timezone) {
        assert(_.isObject(config), `config should be object, but ${config}`);
        assert(_.isString(timezone), `timezone should be string, but ${timezone}`);

        this.btc_client = new BTCClient(
            config.btc.host,
            config.btc.network,
            config.btc.auth,
        );
        this.timezone = timezone;

        this.lucky_mint_block_threshold =
            DIFFICULTY_INSCRIBE_LUCKY_MINT_BLOCK_THRESHOLD;
        if (config.token.difficulty.lucky_mint_block_threshold != null) {
            this.lucky_mint_block_threshold =
                config.token.difficulty.lucky_mint_block_threshold;
            assert(_.isNumber(this.lucky_mint_block_threshold));
        }
    }

    convert_timestamp(timestamp) {
        let date = moment.unix(timestamp);
        date.tz(this.timezone);
        return date.format();
    }

    async next_n_lucky_mint(address, n) {
        assert(_.isString(address), `address should be string, but ${address}`);
        assert(_.isNumber(n), `n should be number, but ${n}`);
        assert(n > 0, `n should be greater than 0, but ${n}`);

        // get current block height
        const { ret, height: block_height } =
            await this.btc_client.get_latest_block_height();
        if (ret !== 0) {
            console.error(`failed to get latest block height`);
            return { ret };
        }

        console.log(`address: ${address}`);
        console.log(`current lucky mint block threshold: ${this.lucky_mint_block_threshold}`);
        console.log(`current block height: ${block_height}`);

        // get block timestamp by block height
        const { ret: get_block_time_ret, block } =
            await this.btc_client.get_block(block_height);
        if (get_block_time_ret !== 0) {
            console.error(
                `failed to get block time by block height: ${block_height}`,
            );
            return { ret: get_block_time_ret };
        }

        console.log(`current block timestamp: ${block.time}, ${this.convert_timestamp(block.time)}`);
        const begin_timestamp = block.time;

        // get next n lucky mint block height
        const lucky_mint_block_height_list = [];
        let i = 1;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            let lucky_mint_block_height = block_height + i;
            let lucky_mint_block_timestamp =
                begin_timestamp + 60 * 12 * i;

            if (this.is_lucky_mint(address, lucky_mint_block_height)) {
                // convert unix timestamp to string by moment
                const timestamp_str = this.convert_timestamp(lucky_mint_block_timestamp);
                lucky_mint_block_height_list.push({
                    block_height: lucky_mint_block_height,
                    timestamp: lucky_mint_block_timestamp,
                    timestamp_str,
                });
            }

            if (lucky_mint_block_height_list.length >= n) {
                break;
            }

            ++i;
        }

        return { ret: 0, list: lucky_mint_block_height_list };
    }

    is_lucky_mint(address, block_height) {
        assert(_.isString(address), `address should be string, but ${address}`);
        assert(
            _.isNumber(block_height),
            `block_height should be number, but ${block_height}`,
        );

        // Get the number of the address
        const address_num = Util.address_number(address);

        // Check if the sum of the block height and the ASCII value is divisible by block_threshold
        if (
            (block_height + address_num) % this.lucky_mint_block_threshold ===
            0
        ) {
            // Special handling for this inscription_item
            return true;
        } else {
            // Normal handling for this inscription_item
            return false;
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
        .option('timezone', {
            type: 'string',
            short: 't',
            demandOption: true,
            describe: 'Timezone',
            default: moment.tz.guess(),
        })
        .help().argv;

    const config_name = argv.config;
    console.log(`config name: ${config_name}`);

    const config_path = path.resolve(__dirname, `../config/${config_name}.js`);
    const config = new Config(config_path);

    const lucky_mint_instance = new LuckyMintHelper(config.config, argv.timezone);
    const { ret, list } = await lucky_mint_instance.next_n_lucky_mint(
        argv.address,
        argv.n,
    );
    if (ret !== 0) {
        console.error(`failed to get next n lucky mint`);
        return { ret };
    }

    console.log(`next ${argv.n} lucky mint: ${JSON.stringify(list, null, 2)}`);
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
