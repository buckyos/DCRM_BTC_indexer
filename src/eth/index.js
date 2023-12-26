const assert = require('assert');
const Web3 = require('web3');
const { ETHIndexStorage } = require('../storage/eth');
const { Util } = require('../util');

class ETHIndex {
    constructor(config) {
        this.config = config;

        const { ret, dir } = Util.get_data_dir(config);
        if (ret !== 0) {
            throw new Error(`failed to get data dir`);
        }
        this.storage = new ETHIndexStorage(dir);
        this.current_block_height = 0;
    }

    async init() {
        const { ret } = await this.storage.init();
        if (ret !== 0) {
            console.error(`failed to init eth storage`);
            return { ret };
        }

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
            _.isNumber(this.config.eth.start_block_height),
            `start_block_height should be number`,
        );
        assert(
            _.isString(this.config.eth.contract_address),
            `contract_address should be string`,
        );
        assert(_.isObject(this.config.eth.contract_abi), `contract_abi should be object`);

        assert(this.web3 === undefined, `web3 should be undefined`);
        assert(this.contract === undefined, `contract should be undefined`);

        try {
            this.web3 = new Web3(this.config.eth.rpc_url);
            this.contract = new web3.eth.Contract(
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
            current_block = await this.web3.eth.getBlock('latest');
            return { ret: 0, height: current_block.number };
        } catch (error) {
            console.error(`failed to get latest block number: ${error}`);
            return { ret: -1 };
        }
    }

    // run forever
    async run() {
        while (true) {
            if (this.current_block_height === 0) {
                // get latest block height already synced
                const { ret, height } =
                    await this.storage.get_latest_block_height();
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
                console.error(`failed to sync once`);
                await Util.sleep(1000 * 5);
                continue;
            } else {
                await Util.sleep(1000 * 10);
            }
        }
    }

    async sync_once() {
        const { ret: get_ret, height: latest_block_number } = await this.get_latest_block_number();
        if (get_ret !== 0) {
            console.error(`failed to get latest block number`);
            return { ret: get_ret };
        }

        if (this.current_block_height >= latest_block_number) {
            console.info(
                `current block height ${this.current_block_height} is already latest`,
            );
            return { ret: 0 };
        }

        const { ret } = await this.sync_blocks(
            this.current_block_height,
            latest_block_number + 1,
        );
        if (ret !== 0) {
            console.error(`failed to sync eth blocks from ${this.current_block_height} to ${latest_block_number + 1}`);
            return { ret };
        }

        this.current_block_height = latest_block_number + 1;
        console.log(`sync eth blocks from ${this.current_block_height} to ${latest_block_number} success`);
        return { ret: 0 };
    }

    // try sync block for range [begin, end)
    async sync_blocks(begin, end) {
        assert(begin < end, `begin should be less than end`);

        // insert all blocks with timestamp
        for (let i = begin; i < end; i++) {
            let block;
            try {
                block = await web3.eth.getBlock(i, false);
            } catch (error) {
                console.error(`failed to get block ${i}: ${error}`);
                return { ret: -1 };
            }

            const { ret } = this.storage.insert_block(i, block.timestamp);
            if (ret !== 0) {
                console.error(`failed to insert eth block ${i}`);
                return { ret };
            }
        }

        // read all point change events
        let events;
        try {
            events = await this.contract.getPastEvents(
                'AllEvents', // the point change event name
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
            const block_height = event.blockNumber;
            const hash = event.returnValues.hash;
            const point = event.returnValues.point;

            const { ret } = this.storage.update_point(
                block_height,
                hash,
                point,
            );
            if (ret !== 0) {
                console.error(
                    `failed to insert point ${hash} for block ${block_height}`,
                );
                return { ret };
            }
        }

        // update latest block height
        {
            const { ret } = await this.storage.update_latest_block_height(
                end - 1,
            );
            if (ret !== 0) {
                console.error(
                    `failed to update latest block height ${end - 1}`,
                );
                return { ret };
            }
        }

        return { ret: 0 };
    }
}
