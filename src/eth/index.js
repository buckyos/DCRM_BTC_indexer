const assert = require('assert');
const { Web3 } = require('web3');
const { ETHIndexStorage } = require('../storage/eth');
const { Util } = require('../util');
const {StateStorage} = require('../storage/state');

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

            console.info(`init web3 success`);
            return { ret: 0 };
        } catch (error) {
            console.error(`failed to init web3: ${error}`);
            return { ret: -1 };
        }
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
                const { ret, height } =
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

                this.current_block_height =
                    height > this.config.eth.genesis_block_height
                        ? height
                        : this.config.eth.genesis_block_height;

                console.info(
                    `sync will start at block height ${this.current_block_height}`,
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

        latest_block_number += 1;

        // sync block in chunk of 100
        const chunk_size = this.eth_blocks_process_step;
        assert(chunk_size > 0, `chunk size should be positive`);

        // eslint-disable-next-line no-constant-condition
        while (true) {
            let end = this.current_block_height + chunk_size;
            if (end > latest_block_number) {
                end = latest_block_number;
            }

            if (end <= this.current_block_height) {
                break;
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

            this.current_block_height = end;
            if (this.current_block_height >= latest_block_number) {
                break;
            }
        }

        console.log(
            `sync eth blocks from ${this.current_block_height} to ${latest_block_number} success`,
        );
        return { ret: 0 };
    }

    // try sync block for range [begin, end)
    async sync_blocks(begin, end) {
        // console.log(`sync eth blocks from ${begin} to ${end}`);
        assert(begin < end, `begin should be less than end`);

        // insert all blocks with timestamp
        for (let i = begin; i < end; i++) {
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

        // read all point change events
        let events;
        try {
            events = await this.contract.getPastEvents(
                'DataPointAdded', // the point change event name
                {
                    fromBlock: begin,
                    toBlock: end - 1,
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
                console.error(`invalid eth event params ${block_height} ${hash} ${point}`);
                return {ret: -1};
            }

            const {ret: convert_ret, hash_str} = Util.hex_to_base58(hash);
            if (convert_ret !== 0) {
                console.error(`failed to convert hash ${hash} to base58`);
                return { ret: convert_ret };
            }

            assert(_.isString(hash_str), `hash should be string after convert to base58 ${hash_str}`);

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
            const { ret } = await this.state_storage.update_eth_latest_block_height(end);
            if (ret !== 0) {
                console.error(
                    `failed to update latest block height ${end - 1}`,
                );
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
                console.warn(`no block found for timestamp ${timestamp}`);
                await Util.sleep(1000 * 5);
                continue;
            }

            target_block_height = block_height;
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
}

module.exports = { ETHIndex };
