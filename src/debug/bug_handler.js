const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { Util } = require('../util.js');
const moment = require('moment');

class BugHandler {
    handle(content) {
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
        const ts = moment(now).format('YYYY-MM-DD_HH:mm:ss.SSS');

        this.error_file = path.join(
            error_dir,
            `error_${process.pid}_${ts}.log`,
        );
    }

    handle(content) {
        assert(_.isObject(content), `content should be object`);

        try {
            // append to error file
            fs.appendFileSync(this.error_file, JSON.stringify(content));
        } catch (error) {
            console.error(`failed to append error to file: ${error}`);
        }
    }
}


module.exports = {
    BugHandler,
    DefaultBugHandler,
};