const Koa = require('koa');
const Router = require('koa-router');
const cors = require('koa-cors');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const log4js = require('log4js');
const { InscribeService } = require('./biz/inscribeService');
const { MintService } = require('./biz/mintService');

const LISTEN_PORT = 3020;

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
    }

    async start() {
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

        console.log('service will listen on port:', LISTEN_PORT);
        app.listen(LISTEN_PORT);
    }
}

function main() {

    log4js.configure({
        appenders: {
            console: { type: "console" },
            fileAppender: {
                type: 'file',
                filename: `./logs/service.log`,
                maxLogSize: 10485760, // 10 MB
                backups: 10,
                compress: false,
            },
        },
        categories: {
            default: {
                appenders: ['console', 'fileAppender'],
                level: 'debug',
            },
        },
    });

    const logger = log4js.getLogger();
    global.logger = logger;

    const service = new Service();
    service.start();
}

main();