const { blog } = require('./blog/init.js');
const { Util } = require('../util.js');
const assert = require('assert');

class LogHelper {
    constructor(config, mode = 'both') {
        assert(_.isObject(config), `config should be an object: ${config}`);
        assert(_.isString(mode), `mode should be string: ${mode}`);

        const log_dir = Util.get_log_dir(config);

        let name = 'dcrm_btc_index';
        if (mode == 'sync') {
            name = 'dcrm_btc_sync';
        } else if (mode == 'index') {
            name = 'dcrm_btc_index';
        } else {
            assert(mode == 'both', `invalid mode: ${mode}`);
            name = 'dcrm_btc_both';
        }

        blog.enable_file_log({
            name,
            dir: log_dir,
            file_max_size: 20 * 1024 * 1024,
            file_max_count: 100,
        });

        this.path_console();
        
        if (config.log) {
            if (config.log.console) {
                this.enable_console_target(true);
            } else {
                this.enable_console_target(false);
            }

            if (config.log.level) {
                assert(
                    ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(
                        config.log.level,
                    ),
                    `invalid log level: ${config.log.level}`,
                );

                this.set_level(config.log.level);
            }
        }
    }

    enable_console_target(enable) {
        blog.enableConsoleTarget(enable);
    }

    path_console() {
        blog.patch_console();
    }

    set_level(level) {
        blog.setLevel(level);
    }
}

module.exports = {
    LogHelper,
};
