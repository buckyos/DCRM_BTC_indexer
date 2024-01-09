const fs = require('fs');

const os = require('os');
const { BugHandler } = require('./bug_handler.js');
const { PostNotifier } = require('./notify.js');
const { DefaultBugHandler } = require('./bug_handler.js');

class BugMonitor {
    constructor(config) {
        this.config = config;

        this.handlers = [];
        this.handlers.push(new DefaultBugHandler(config));
        const user_handler = this._load_bug_handler();
        if (user_handler) {
            this.handlers.push(user_handler);
        }

        if (config.monitor && config.monitor.notify_url) {
            this.handlers.push(new PostNotifier(config.monitor.notify_url));
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
        if (fs.existsSync('./user_handler.js')) {
            try {
                const CustomBugHandler = require('./user_handler.js');
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
        const content = {
            service:'dcrm-btc-index',
            hostname: os.hostname(),
            network: this.config.btc.network,
            message: error.message,
            stack: error.stack,
        };

        for (const handler of this.handlers) {
            handler.handle(content);
        }
    }
}

module.exports = {
    BugMonitor,
    BugHandler,
};
