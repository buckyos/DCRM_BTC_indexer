require('./global');
const Koa = require('koa');
const Router = require('koa-router');
const cors = require('koa-cors');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const { InscribeService } = require('./biz/inscribeService');
const { MintService } = require('./biz/mintService');
const { ChainService } = require('./biz/chainService');
const INDEX_CONFIG = require('../../config');

class Service {
    constructor() {
        this.m_router = new Router();
    }

    get router() {
        return this.m_router;
    }

    _register() {
        const inscribeService = new InscribeService();
        inscribeService.registerRouter(this.m_router);

        const mintService = new MintService();
        mintService.registerRouter(this.m_router);

        const chainService = new ChainService();
        chainService.registerRouter(this.m_router);
    }

    async start() {
        const listenPort = INDEX_CONFIG.service.port;

        this._register();

        const app = new Koa();
        app.use(bodyParser({
            enableTypes: ['json', 'form', 'text'],
            extendTypes: {
                text: ['text/xml', 'application/xml']
            }
        }));

        app.use(logger());
        app.use(cors());

        app.use(this.m_router.routes());

        console.log('service will listen on port:', listenPort);
        app.listen(listenPort);
    }
}

function main() {
    const service = new Service();
    service.start();
}

main();