const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {Util} = require('../util.js');
const moment = require('moment');

class BugHandler {
    handle(error) {
        throw new Error('Not implemented');
    }
}

class DefaultBugHandler extends BugHandler {
    constructor(config) {
        super();

        const log_dir = Util.get_log_dir(config);
        const error_dir = path.join(log_dir, 'errors');
        if (!fs.existsSync(error_dir)) {
            fs.mkdirSync(error_dir, { recursive: true });
        }

        const now = new Date();
        const ts = moment(now).format('YYYY-MM-DD HH:mm:ss.SSS');

        this.error_file = path.join(error_dir, `error_${process.pid}_${ts}.log`);
    }

    handle(error) {
        assert(_.isString(error), `error should be string`);

        try{
            // append to error file
            fs.appendFileSync(this.error_file, error)
        } catch (error) {
            console.error(`failed to append error to file: ${error}`);
        }
    }
}


class BugMonitor {
    constructor(config) {
        this.config = config;

        this.handlers = [];
        this.handlers.push(new DefaultBugHandler(config));
        const user_handler = this._load_bug_handler();
        if (user_handler) {
            this.handlers.push(user_handler);
        }

        // process the uncaught exception
        process.on('uncaughtException', (error) => {
            this.report(error);
        });

        // process the unhandled rejection
        process.on('unhandledRejection', (error) => {
            this.report(error);
        });
    }

    // load user bug handler if exists
    _load_bug_handler() {
        if (fs.existsSync('./bug_handler.js')) {
            try {
                const CustomBugHandler = require('./bug_handler');
                return new CustomBugHandler(this.config);
            } catch (error) {
                console.error(`failed to load bug handler: ${error}`);
                return null;
            }
        }

        return null;
    }

    // called if the is an error that should notify the user
    report(error) {
        const info = {
            message: error.message,
            stack: error.stack,
        };

        const info_str = JSON.stringify(info);

        for (const handler of this.handlers) {
            handler.handle(info_str);
        }
    }
}


module.exports = {
    BugMonitor,BugHandler,
};