const winston = require('winston');
require('winston-daily-rotate-file');

const path = require('path');
const fs = require('fs');

class LogHelper {
    constructor() {
        const base_dir = process.platform === 'win32' ? 'C:\\logs' : '/var/log';
        const log_dir = path.join(base_dir, 'dcrm_brc_index');
        if (!fs.existsSync(log_dir)) {
            fs.mkdirSync(log_dir, { recursive: true });
        }

        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(
                    (info) =>
                        `[${info.timestamp}][${info.level}]: ${info.message}`,
                ),
            ),

            transports: [
                new winston.transports.DailyRotateFile({
                    filename: path.join(
                        log_dir,
                        `error-${process.pid}-%DATE%.log`,
                    ),
                    datePattern: 'YYYY-MM-DD-HH',
                    zippedArchive: true,
                    maxSize: '20m',
                    maxFiles: '100d',
                    //level: 'error',
                }),
                new winston.transports.DailyRotateFile({
                    filename: path.join(
                        log_dir,
                        `info-${process.pid}-%DATE%.log`,
                    ),
                    datePattern: 'YYYY-MM-DD-HH',
                    zippedArchive: true,
                    maxSize: '20m',
                    maxFiles: '100d',
                    level: 'info',
                }),
            ],
        });

        if (process.env.NODE_ENV !== 'production') {
            this.logger.add(
                new winston.transports.Console({
                    format: winston.format.simple(),
                }),
            );
        }
    }

    path_console() {
        const logger = this.logger;
        const original_console = console;

        console.debug = function (...args) {
            logger.debug(...args);
        };

        console.log = function (...args) {
            logger.info(...args);
        };

        console.info = function (...args) {
            logger.info(...args);
        };

        console.warn = function (...args) {
            logger.warn(...args);
        };

        console.error = function (...args) {
            logger.error(...args);
        };
    }
}

module.exports = { LogHelper };
