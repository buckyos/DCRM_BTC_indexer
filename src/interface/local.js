const assert = require('assert');
const Koa = require('koa');
const Router = require('koa-router');
const { Util } = require('../util.js');
const { HashHelper } = require('../token_index/ops/hash.js');
const { ETHIndex } = require('../eth/index');

class IndexLocalInterface {
    constructor(config, executor) {
        assert(_.isObject(config), `invalid config: ${config}`);
        assert(_.isObject(executor), `invalid executor: ${executor}`);

        this.config = config;
        this.executor = executor;

        this.eth_index = new ETHIndex(config);
        this.hash_helper = new HashHelper(this.eth_index);
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
        const router = new Router();

        this._register_router(router);

        // use router
        app.use(router.routes());
        app.use(router.allowedMethods());

        const port = this.config.interface.port;
        assert(
            _.isNumber(port),
            `invalid local interface port: ${port}`,
        );

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

            const timestamp = Util.get_now_as_timestamp();
            console.log(`will query hash weight ${mixhash} at ${timestamp} for user ${ctx.ip} request`);

            const { ret, weight, point } = await this.hash_helper.query_hash_weight(
                timestamp,
                mixhash,
            );
            if (ret !== 0) {
                ctx.status = 500;
                ctx.body = `Internal server error ${ret}`;
                return;
            }

            const result = {
                mixhash,
                timestamp,
                weight,
                point,
            };

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
    }
}

module.exports = { IndexLocalInterface };
