const assert = require('assert');
const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const { Util } = require('../util.js');
const { HashHelper } = require('../token_index/ops/hash.js');
const { ETHIndex } = require('../eth/index');
const { TokenIndexStorage } = require('../storage/token');
const { ResonanceVerifier } = require('../token_index/resonance_verifier');
const { UTXORetriever } = require('./utxo');
const { TokenStat } = require('./stat');
const { IncomeStat } = require('./income');

// for better performance when query the latest block height for now
const ETH_LATEST_BLOCK_TIMESTAMP_DIFF = 24;

class StateService {
    constructor(config, executor) {
        assert(_.isObject(config), `invalid config: ${config}`);
        assert(_.isObject(executor), `invalid executor: ${executor}`);

        this.config = config;
        this.executor = executor;

        this.storage = new TokenIndexStorage(config);
        this.user_hash_relation_storage =
            this.storage.get_user_hash_relation_storage();
        this.resonance_verifier = new ResonanceVerifier(this.storage);

        this.utxo_retriever = new UTXORetriever(config);
        this.stat = new TokenStat(config);

        this.income_stat = new IncomeStat(config, executor);

        this.block_state = {};
        this.current_block_height = 0;
    }

    async init() {
        const { ret } = await this.storage.init();
        if (ret !== 0) {
            console.error(`failed to init storage`);
            return { ret };
        }

        // init stat
        const { ret: stat_ret } = await this.stat.init();
        if (stat_ret !== 0) {
            console.error(`failed to init stat`);
            return { ret: stat_ret };
        }

        // init income stat
        const { ret: income_stat_ret } = await this.income_stat.init();
        if (income_stat_ret !== 0) {
            console.error(`failed to init income stat`);
            return { ret: income_stat_ret };
        }

        return { ret: 0 };
    }

    _refresh_block_state() {
        const block_height = this.executor.get_current_block_height();
        if (block_height !== this.current_block_height) {
            this.current_block_height = block_height;
            this.block_state = {
                income: {},
            };
        }
    }

    async get_resonances_by_hash(hash) {
        assert(_.isString(hash), `invalid hash: ${hash}`);

        this._refresh_block_state();

        if (this.block_state[hash] == null) {
            const { ret } = await this.resonance_verifier.verify_hash(
                hash,
                this.current_block_height,
            );
            if (ret !== 0) {
                console.error(`failed to verify resonance for hash ${hash}`);
                return { ret };
            }

            this.block_state[hash] = true;
        }

        const { ret, data } =
            await this.user_hash_relation_storage.get_resonances_by_hash(hash);
        if (ret !== 0) {
            console.error(`failed to get_resonances_by_hash ${hash}`);
            return { ret };
        }

        return { ret: 0, data };
    }

    async get_resonances_by_address(address) {
        assert(_.isString(address), `invalid address: ${address}`);

        this._refresh_block_state();

        if (this.block_state[address] == null) {
            const { ret } = await this.resonance_verifier.verify_user(
                address,
                this.current_block_height,
            );
            if (ret !== 0) {
                console.error(
                    `failed to verify resonance for address ${address}`,
                );
                return { ret };
            }

            this.block_state[address] = true;
        }

        const { ret, data } =
            await this.user_hash_relation_storage.get_resonances_by_address(
                address,
            );
        if (ret !== 0) {
            console.error(`failed to get_resonances_by_address ${address}`);
            return { ret };
        }

        return { ret: 0, data };
    }

    async get_inscribe_data_by_hash(hash) {
        assert(_.isString(hash), `invalid hash: ${hash}`);
        const { valid, mixhash } = Util.check_and_fix_mixhash(hash);
        if (!valid) {
            console.error(`invalid hash: ${hash}`);
            return { ret: -1 };
        }

        const { ret, data } = await this.storage.get_inscribe_data(mixhash);
        if (ret !== 0) {
            console.error(
                `failed to get_inscribe_data_by_hash ${hash} ${mixhash}`,
            );
            return { ret };
        }

        return { ret: 0, data };
    }

    /**
     * @comment get user income stat for last 24 hours
     * @param {string} address
     * @returns {ret: number, stat: {income: {op_type: string, change_amount: string}, inner_income: {op_type: string, change_amount: string}}}
     */
    async get_user_income_stat(address) {
        assert(_.isString(address), `address should be string: ${address}`);

        this._refresh_block_state();

        if (this.block_state.income[address] == null) {
            const { ret, stat } = await this.income_stat.get_user_income_stat(
                address,
            );
            if (ret !== 0) {
                console.error(`failed to get user income stat for ${address}`);
                return { ret };
            }

            this.block_state.income[address] = stat;
        }
        
        return { ret: 0, stat: this.block_state.income[address] };
    }
}

class IndexLocalInterface {
    constructor(config, executor) {
        assert(_.isObject(config), `invalid config: ${config}`);
        assert(_.isObject(executor), `invalid executor: ${executor}`);

        this.config = config;
        this.executor = executor;

        this.eth_index = new ETHIndex(config);
        this.hash_helper = new HashHelper(this.eth_index);
        this.state_service = new StateService(config, executor);
    }

    /**
     *
     * @returns {ret: number}
     */
    async start() {
        // first init eth index
        const { ret: eth_index_ret } = await this.eth_index.init();
        if (eth_index_ret !== 0) {
            console.error(`failed to init eth index`);
            return { ret: eth_index_ret };
        }

        // then init state service
        const { ret: state_ret } = await this.state_service.init();
        if (state_ret !== 0) {
            console.error(`failed to init state service`);
            return { ret: state_ret };
        }

        // then start http server
        const { ret: http_ret } = await this._start_http_server();
        if (http_ret !== 0) {
            console.error(`failed to start http server`);
            return { ret: http_ret };
        }

        return { ret: 0 };
    }

    _start_http_server() {
        // start local interface
        const app = new Koa();
        app.use(bodyParser());

        const router = new Router();

        this._register_router(router);

        // use router
        app.use(router.routes());
        app.use(router.allowedMethods());

        const port = this.config.interface.port;
        assert(_.isNumber(port), `invalid local interface port: ${port}`);

        const server = app.listen(port, '127.0.0.1');
        this.server = server;

        return new Promise((resolve) => {
            server.on('listening', () => {
                console.log(`Server is listening on port ${port}`);
                resolve({ ret: 0 });
            });

            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    console.error(
                        `Port ${port} is in use, please use a different port.`,
                    );
                    resolve({ ret: -1 });
                } else {
                    console.log(`start local interface error: ${err}`);
                    resolve({ ret: -1 });
                }
            });
        });
    }

    _register_router(router) {
        router.get('/hash-weight/:value', async (ctx) => {
            const value = ctx.params.value;
            if (!_.isString(value)) {
                ctx.status = 400;
                ctx.body = 'Bad request';
                return;
            }

            const { valid, mixhash } = Util.check_and_fix_mixhash(value);
            if (!valid) {
                ctx.status = 400;
                ctx.body = 'Bad request';
                return;
            }

            // t=? if t query is not specified, use now
            let t = ctx.query.t;
            if (_.isString(t)) {
                const timestamp = parseInt(t);
                if (isNaN(timestamp)) {
                    ctx.status = 400;
                    ctx.body = `Bad request: invalid timestamp ${t}`;
                    return;
                }

                t = timestamp;
            }

            // use the last block timestamp if t is not specified
            const timestamp = t || (Util.get_now_as_timestamp() - ETH_LATEST_BLOCK_TIMESTAMP_DIFF);
            if (!_.isNumber(timestamp)) {
                ctx.status = 400;
                ctx.body = `Bad request: invalid timestamp ${timestamp}`;
                return;
            }

            console.log(
                `will query hash weight ${mixhash} at ${timestamp} for user ${ctx.ip} request`,
            );

            const { ret, chain, exp, weight, point } =
                await this.hash_helper.query_hash_weight(timestamp, mixhash);
            if (ret !== 0) {
                ctx.status = 500;
                ctx.body = `Internal server error ${ret}`;
                return;
            }

            const result = {
                mixhash,
                timestamp,
                weight,

                chain,
                exp,
                point,
            };

            ctx.body = result;
        });

        // for batch query
        router.post('/hash-weight', async (ctx) => {
            const body = ctx.request.body;
            if (!_.isObject(body)) {
                ctx.status = 400;
                ctx.body = 'Bad request';
                return;
            }

            const list = body.values;
            if (!_.isArray(list)) {
                ctx.status = 400;
                ctx.body = 'Bad request';
                return;
            }

            // use the last block timestamp if t is not specified
            const timestamp = body.timestamp || (Util.get_now_as_timestamp() - ETH_LATEST_BLOCK_TIMESTAMP_DIFF);
            if (!_.isNumber(timestamp)) {
                ctx.status = 400;
                ctx.body = `Bad request: invalid timestamp ${timestamp}`;
                return;
            }

            console.log(`will query hash weight for ${timestamp} ${list.length} values`);

            const result = {
                ret: 0,
                result: [],
            };

            for (const value of list) {
                const { valid, mixhash } = Util.check_and_fix_mixhash(value);
                if (!valid) {
                    result.ret = -1;
                    result.msg = `invalid hash: ${value}`;
                    continue;
                }

                const { ret, chain, exp, weight, point } =
                    await this.hash_helper.query_hash_weight(
                        timestamp,
                        mixhash,
                    );
                if (ret !== 0) {
                    result.ret = ret;
                    result.msg = `failed to query hash weight for ${value}`;
                    break;
                }

                result.result.push({
                    value,
                    weight,
                    chain,
                    exp,
                    point,
                })
            }

            ctx.body = result;
        });

        router.get('/status', async (ctx) => {
            const { ret, status } = await this.executor.status();
            if (ret !== 0) {
                ctx.status = 500;
                ctx.body = `Internal server error ${ret}`;
                return;
            }

            ctx.body = status;
        });

        router.get('/resonance/hash/:hash', async (ctx) => {
            const hash = ctx.params.hash;
            if (!_.isString(hash)) {
                ctx.status = 400;
                ctx.body = 'Bad request';
                return;
            }

            const { valid, mixhash } = Util.check_and_fix_mixhash(hash);
            if (!valid) {
                ctx.status = 400;
                ctx.body = 'Bad request';
                return;
            }

            const { ret, data } =
                await this.state_service.get_resonances_by_hash(mixhash);
            if (ret !== 0) {
                ctx.status = 500;
                ctx.body = `Internal server error ${ret}`;
                return;
            }

            ctx.body = data;
        });

        router.get('/resonance/address/:address', async (ctx) => {
            const address = ctx.params.address;
            if (!_.isString(address)) {
                ctx.status = 400;
                ctx.body = 'Bad request';
                return;
            }

            const { ret, data } =
                await this.state_service.get_resonances_by_address(address);
            if (ret !== 0) {
                ctx.status = 500;
                ctx.body = `Internal server error ${ret}`;
                return;
            }

            ctx.body = data;
        });

        router.get('/inscribe-data/:hash', async (ctx) => {
            const hash = ctx.params.hash;
            if (!_.isString(hash)) {
                ctx.status = 400;
                ctx.body = 'Bad request';
                return;
            }

            let { ret, data } =
                await this.state_service.get_inscribe_data_by_hash(hash);
            if (ret !== 0) {
                ctx.status = 500;
                ctx.body = `Internal server error ${ret}`;
                return;
            }

            if (data == null) {
               data = {};
            }

            ctx.body = data;
        });

        router.get('/utxo/:inscription_id', async (ctx) => {
            const inscription_id = ctx.params.inscription_id;
            if (!_.isString(inscription_id)) {
                ctx.status = 400;
                ctx.body = 'Bad request';
                return;
            }

            const { ret, status, info } =
                await this.state_service.utxo_retriever.get_utxo_by_inscription_id(
                    inscription_id,
                );
            if (ret !== 0) {
                ctx.status = 500;
                ctx.body = `Internal server error ${ret}`;
                return;
            }

            if (status >= 200 && status < 300) {
                ctx.status = status;
                ctx.body = info;
            } else {
                ctx.status = status;
            }
        });

        const stat_routine = async (ctx) => {
            const type = ctx.params.type || 'all';
            const start = ctx.query.start || 0;
            const end = ctx.query.end || 0;

            const { ret, status, stat } = await this.state_service.stat.stat(
                type,
                start,
                end,
            );
            if (ret !== 0) {
                ctx.status = 500;
                ctx.body = `Internal server error ${ret}`;
                return;
            }

            if (status == null || (status >= 200 && status < 300)) {
                ctx.status = 200;
                ctx.body = JSON.stringify(stat, null, 2);
            } else {
                ctx.status = status;
            }
        };

        router.get('/stat/:type', stat_routine);
        router.get('/stat', stat_routine);

        // stat top n balance
        router.get('/stat/balances/:n', async (ctx) => {
            let n = ctx.params.n || '100';
            n = parseInt(n);
            if (isNaN(n)) {
                ctx.status = 400;
                ctx.body = `Bad request with invalid n: ${n}`;
                return;
            }

            const { ret, status, stat } =
                await this.state_service.stat.stat_balance(n);
            if (ret !== 0) {
                ctx.status = 500;
                ctx.body = `Internal server error ${ret}`;
                return;
            }

            if (status == null || (status >= 200 && status < 300)) {
                ctx.status = 200;
                ctx.body = JSON.stringify(stat, null, 2);
            } else {
                ctx.status = status;
            }
        });

        // user income stat
        router.get('/stat/income/:address', async (ctx) => {
            const address = ctx.params.address;
            if (!_.isString(address)) {
                ctx.status = 400;
                ctx.body = 'Bad request';
                return;
            }

            const { ret, stat } =
                await this.state_service.get_user_income_stat(address);
            if (ret !== 0) {
                ctx.status = 500;
                ctx.body = `Internal server error ${ret}`;
                return;
            }

            
            ctx.status = 200;
            ctx.body = JSON.stringify(stat, null, 2);
        });
    }
}

module.exports = { IndexLocalInterface };
