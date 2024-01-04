require('./global');
const Koa = require('koa');
const Router = require('koa-router');
const cors = require('koa-cors');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const { InscribeService } = require('./biz/inscribeService');
const { MintService } = require('./biz/mintService');
const { ChainService } = require('./biz/chainService');
const { SearchService } = require('./biz/searchService');
const { config } = require('./config/config');
const { store } = require('./biz/store');
const path = require('path');
const assert = require('assert');
const fs = require('fs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');


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

        const searchService = new SearchService();
        searchService.registerRouter(this.m_router);
    }

    async start() {
        const listenPort = config.servicePort;

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
    // first parse args
    const argv = yargs(hideBin(process.argv))
        .option('config', {
            alias: 'c',
            type: 'string',
            description: 'Select the configuration of bitcoin ethereum network',
            choices: ['formal', 'test'],
            default: 'formal',
        })
        .help().argv;
    const config_name = argv.config;
    console.log(`config name: ${config_name}`);

    const configPath = path.resolve(__dirname, `../../config/${config_name}.js`);
    assert(fs.existsSync(configPath), `config file not found: ${configPath}`);

    config.init(configPath);
    store.init(config);

    const service = new Service();
    service.start();
}

main();