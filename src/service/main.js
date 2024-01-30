require('./global');
const Koa = require('koa');
const Router = require('koa-router');
const cors = require('koa-cors');
const koaLogger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const { InscribeService } = require('./biz/inscribeService');
const { MintService } = require('./biz/mintService');
const { ChainService } = require('./biz/chainService');
const { SearchService } = require('./biz/searchService');
const { RankService } = require('./biz/rankService');
const { IncomeService } = require('./biz/incomeService');
const { StatManager } = require('./mods/statManager');
const { Config } = require('./config/config');
const { Store } = require('./biz/store');
const path = require('path');
const assert = require('assert');
const fs = require('fs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');


class Service {
    constructor(conf, store) {
        this.m_config = conf;
        this.m_store = store;
        this.m_router = new Router();

        this.m_statManager = new StatManager(this.m_store);
    }

    get router() {
        return this.m_router;
    }

    _register() {
        const inscribeService = new InscribeService(this.m_config, this.m_store);
        inscribeService.registerRouter(this.m_router);

        const mintService = new MintService(this.m_config, this.m_store);
        mintService.registerRouter(this.m_router);

        const chainService = new ChainService(this.m_config, this.m_store);
        chainService.registerRouter(this.m_router);

        const searchService = new SearchService(this.m_config, this.m_store);
        searchService.registerRouter(this.m_router);

        const rankService = new RankService(this.m_config, this.m_store);
        rankService.registerRouter(this.m_router);

        const incomeService = new IncomeService(this.m_config, this.m_store, this.m_statManager);
        incomeService.registerRouter(this.m_router);
    }

    async start() {
        const listenPort = this.m_config.service.port;

        this._register();

        const app = new Koa();
        app.use(bodyParser({
            enableTypes: ['json', 'form', 'text'],
            extendTypes: {
                text: ['text/xml', 'application/xml']
            }
        }));

        app.use(koaLogger());
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
        .option('log', {
            type: 'string',
            describe: 'Log level',
            choices: ['debug', 'info', 'warn'],
        })
        .help().argv;
    const config_name = argv.config;
    console.log(`config name: ${config_name}`);

    const logLevel = argv.log;

    console.log('loglevel:', logLevel);

    const configPath = path.resolve(__dirname, `../../config/${config_name}.js`);
    assert(fs.existsSync(configPath), `config file not found: ${configPath}`);

    const config = new Config();
    config.init(configPath);
    logger.level = logLevel || config.service.log_level || 'info';

    store = new Store();

    store.init(config);

    watchExit(store);

    const service = new Service(config, store);
    service.start();
}

function watchExit(store) {
    process.on('exit', () => {
        store.close();
        console.log('Process is exiting.');
    });

    process.on('SIGINT', () => {
        store.close();
        console.log('Process was interrupted (SIGINT).');
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        store.close();
        console.log('Process was terminated (SIGTERM).');
        process.exit(0);
    });

    process.on('uncaughtException', (error) => {
        console.error('Uncaught exception:', error);
        store.close();
        process.exit(1);
    });
}

main();