const assert = require('assert');
const { Web3 } = require('web3');
const { ETHIndexStorage } = require('../storage/eth');
const { Util } = require('../util');
const { StateStorage } = require('../storage/state');
const BigNumber = require('bignumber.js');

class ETHIndex {
    constructor(config) {
        this.config = config;

        const { ret, dir } = Util.get_data_dir(config);
        if (ret !== 0) {
            throw new Error(`failed to get data dir`);
        }
        this.storage = new ETHIndexStorage(dir);
        this.state_storage = new StateStorage(dir);

        this.current_block_height = 0;
        this.eth_blocks_process_step = 64;

        this.contract = undefined;
        this.lucky_mint_contract = undefined;
    }

    /**
     * init eth index at start
     * @returns {Promise<{ret: number}>}
     */
    async init() {
        // first init state storage
        const { ret: init_state_storage_ret } = await this.state_storage.init();
        if (init_state_storage_ret !== 0) {
            console.error(`failed to init inscription index state storage`);
            return { ret: init_state_storage_ret };
        }

        // then init eth storage
        const { ret } = await this.storage.init();
        if (ret !== 0) {
            console.error(`failed to init eth storage`);
            return { ret };
        }

        // then init web3
        const { ret: init_web3_ret } = await this.init_web3();
        if (init_web3_ret !== 0) {
            console.error(`failed to init web3`);
            return { ret: init_web3_ret };
        }

        console.info(`init eth index success`);
        return { ret: 0 };
    }

    async init_web3() {
        assert(_.isString(this.config.eth.rpc_url), `rpc_url should be string`);
        assert(
            _.isString(this.config.eth.contract_address),
            `contract_address should be string`,
        );
        assert(
            _.isObject(this.config.eth.contract_abi),
            `contract_abi should be object`,
        );

        assert(this.web3 === undefined, `web3 should be undefined`);
        assert(this.contract === undefined, `contract should be undefined`);

        try {
            this.web3 = new Web3(this.config.eth.rpc_url);
            this.contract = new this.web3.eth.Contract(
                this.config.eth.contract_abi,
                this.config.eth.contract_address,
            );

            this.lucky_mint_contract = new this.web3.eth.Contract(
                this.config.eth.lucky_mint_contract_abi,
                this.config.eth.lucky_mint_contract_address,
            );

            console.info(`init web3 success`);
            return { ret: 0 };
        } catch (error) {
            console.error(`failed to init web3: ${error}`);
            return { ret: -1 };
        }
    }

    /**
     *
     * @returns {Promise<{ret: number, status: object}>}
     */
    async status() {
        const { ret, height: eth } = await this.get_latest_block_number();
        if (ret !== 0) {
            console.error(`failed to get latest block number`);
            return { ret };
        }

        const { ret: get_local_ret, height: local } =
            await this.state_storage.get_eth_latest_block_height();
        if (get_local_ret !== 0) {
            console.error(`failed to get eth local block height`);
            return { ret: get_local_ret };
        }

        const genesis_block_height = this.config.eth.genesis_block_height;

        let percent;
        if (eth > local) {
            percent = (((local - genesis_block_height) / (eth - genesis_block_height)) * 100).toFixed(2);
        } else {
            percent = 100;
        }

        return {
            ret: 0,

            status: {
                eth,
                local,
                genesis_block_height,
                percent,
            },
        };
    }

    /**
     *
     * @returns {ret: number, height: number}
     */
    async get_latest_block_number() {
        try {
            let current_block = await this.web3.eth.getBlockNumber();
            return { ret: 0, height: Number(current_block) };
        } catch (error) {
            console.error(`failed to get latest block number: ${error}`);
            return { ret: -1 };
        }
    }

    // run forever
    async run() {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (this.current_block_height === 0) {
                // get latest block height already synced
                let { ret, height } =
                    await this.state_storage.get_eth_latest_block_height();
                if (ret !== 0) {
                    console.error(`failed to get latest block height`);
                    await this.sleep(1000 * 5);
                    continue;
                }

                // get config start block height that should be synced
                assert(
                    _.isNumber(this.config.eth.genesis_block_height),
                    `invalid eth start block height`,
                );

                // we should skip the latest synced block height
                height += 1;

                this.current_block_height =
                    height > this.config.eth.genesis_block_height
                        ? height
                        : this.config.eth.genesis_block_height;

                console.info(
                    `eth sync will start at block height ${this.current_block_height}`,
                );
            }

            assert(
                this.current_block_height > 0,
                `invalid block height ${this.current_block_height}`,
            );

            const { ret } = await this.sync_once();
            if (ret !== 0) {
                console.error(`failed to sync eth once`);
                await Util.sleep(1000 * 3);
                continue;
            } else {
                await Util.sleep(1000 * 5);
            }
        }
    }

    // sync range [this.current_block_height, latest_block_number]
    async sync_once() {
        let { ret: get_ret, height: latest_block_number } =
            await this.get_latest_block_number();
        if (get_ret !== 0) {
            console.error(`failed to get latest block number`);
            return { ret: get_ret };
        }

        if (latest_block_number < this.current_block_height) {
            return { ret: 0 };
        }

        // sync block in chunk of 100
        const chunk_size = this.eth_blocks_process_step;
        assert(chunk_size > 0, `chunk size should be positive`);

        const sync_begin = this.current_block_height;

        // sync blocks in chunk during [this.current_block_height, latest_block_number]
        // eslint-disable-next-line no-constant-condition
        while (true) {
            let end = this.current_block_height + chunk_size;
            if (end > latest_block_number) {
                end = latest_block_number;
            }

            const { ret } = await this.sync_blocks(
                this.current_block_height,
                end,
            );
            if (ret !== 0) {
                console.error(
                    `failed to sync eth blocks from ${this.current_block_height} to ${end}`,
                );
                return { ret };
            }

            this.current_block_height = end + 1;
            if (this.current_block_height >= latest_block_number) {
                break;
            }
        }

        console.log(
            `sync eth blocks [${sync_begin}, ${latest_block_number}] success`,
        );
        return { ret: 0 };
    }

    // try sync block for range [begin, end]
    async sync_blocks(begin, end) {
        // console.log(`sync eth blocks from ${begin} to ${end}`);
        assert(begin <= end, `begin should be less than end`);

        // insert all blocks with timestamp
        for (let i = begin; i <= end; i++) {
            let block;
            try {
                block = await this.web3.eth.getBlock(i, false);
            } catch (error) {
                console.error(`failed to get block ${i}: ${error}`);
                return { ret: -1 };
            }

            const { ret } = await this.storage.insert_block(
                i,
                Number(block.timestamp),
            );
            if (ret !== 0) {
                console.error(`failed to insert eth block ${i}`);
                return { ret };
            }
        }

        console.debug(`insert eth blocks [${begin}, ${end}] success`);

        // read all point change events
        let events;
        try {
            events = await this.contract.getPastEvents(
                'DataPointAdded', // the point change event name
                {
                    fromBlock: begin,
                    toBlock: end,
                },
            );
        } catch (error) {
            console.error(`failed to get past events}`, error);
            return { ret: -1 };
        }

        // process all events
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const block_height = Number(event.blockNumber);
            const hash = event.returnValues.mixedHash;
            let point = event.returnValues.point;

            // check params
            if (!_.isString(hash) || typeof point !== 'bigint') {
                // should not happen?
                console.error(
                    `invalid eth event params ${block_height} ${hash} ${point}`,
                );
                return { ret: -1 };
            }

            const { ret: convert_ret, hash_str } = Util.hex_to_base58(hash);
            if (convert_ret !== 0) {
                console.error(`failed to convert hash ${hash} to base58`);
                return { ret: convert_ret };
            }

            assert(
                _.isString(hash_str),
                `hash should be string after convert to base58 ${hash_str}`,
            );

            point = Number(point);

            const { ret } = await this.storage.update_point(
                block_height,
                hash_str,
                point,
            );
            if (ret !== 0) {
                console.error(
                    `failed to insert point ${hash}=${point} for block ${block_height}`,
                );
                return { ret };
            }
        }

        // update latest block height
        {
            const { ret } =
                await this.state_storage.update_eth_latest_block_height(
                    begin,
                    end,
                );
            if (ret !== 0) {
                console.error(`failed to update latest block height ${end}`);
                return { ret };
            }
        }

        return { ret: 0 };
    }

    /**
     * query point for hash at timestamp historically
     * @param {number} timestamp
     * @param {string} hash
     * @returns {ret: number, point: number}
     */
    async query_hash_point(timestamp, hash) {
        // find target block height for timestamp
        // if now found, we should wait for the block and retry
        let target_block_height;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const { ret, block_height } =
                await this.storage.query_block_with_timestamp(timestamp);
            if (ret !== 0) {
                console.error(`failed to query block with timestamp`);
                return { ret };
            }

            if (block_height == null) {

                // if we have not fetch the first block yet, we should fetch the first block
                if (this.first_block_timestamp == null) {
                    const {ret, block_height, timestamp} = await this.storage.query_first_block();
                    if (ret !== 0) {
                        console.error(`failed to query first eth block`);
                        return { ret };
                    }
                    this.first_block_timestamp = timestamp;
                    this.first_block_height = block_height;
                }

                // on testnet this case maybe happen
                if (this.first_block_timestamp != null && timestamp < this.first_block_timestamp) {
                    console.warn(
                        `timestamp ${timestamp} is less than first block timestamp ${this.first_block_timestamp}`,
                    );
                    return { ret: 0, point: 1 };
                }

                console.warn(
                    `no eth block found for timestamp ${timestamp}, now wait and retry...`,
                );
                await Util.sleep(1000 * 5);
                continue;
            }

            target_block_height = block_height;
            console.info(
                `found eth block with timestamp ${timestamp}: ${target_block_height}`,
            );
            break;
        }

        const { ret: query_ret, point } = await this.storage.get_history_point(
            target_block_height,
            hash,
        );
        if (query_ret !== 0) {
            console.error(`failed to query point ${hash}`);
            return { ret: query_ret };
        }

        if (point == 0) {
            console.warn(
                `no point found for hash ${hash}, now use default value 1`,
            );
            return { ret: 0, point: 1 };
        }

        console.log(`query point ${hash} success ${point}`);
        return { ret: 0, point };
    }

    /**
     *
     * @param {string} address
     * @param {string} lucky
     * @returns {Promise<{ret: number, exists: boolean, amount: string}>}
     */
    async query_lucky_mint(address, lucky) {
        assert(_.isString(address), `invalid address ${address}`);
        assert(_.isString(lucky), `invalid lucky ${lucky}`);

        return new Promise((resolve) => {
            this.lucky_mint_contract.methods
                .getBurnedMintCount(address, lucky)
                .call()
                .then((result) => {
                    const amount = new BigNumber(result).toString();
                    if (amount === '0') {
                        console.info(
                            `no burn lucky mint found ${address} ${lucky}`,
                        );
                        resolve({ ret: 0, exists: false });
                    } else {
                        console.info(
                            `found burn lucky mint ${address} ${lucky} ${amount}`,
                        );
                        resolve({ ret: 0, exists: true, amount });
                    }
                })
                .catch((error) => {
                    console.error(
                        `failed to query lucky mint ${address} ${lucky} ${error}`,
                    );
                    resolve({ ret: -1 });
                });
        });
    }
}

module.exports = { ETHIndex };
