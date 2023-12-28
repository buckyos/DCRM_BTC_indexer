const log4js = require('log4js');

log4js.configure({
    appenders: {
        console: { type: "console" },
        fileAppender: {
            type: 'file',
            filename: `./logs/service-${process.pid}.log`,
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

process.on('uncaughtException', (err) => {
    logger.error(`uncaughtException: ${err}`);
});

process.on('unhandledRejection', (reason, p) => {
    logger.error(`unhandledRejection: ${reason}`);
});