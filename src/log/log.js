const { blog } = require('./blog/init.js');
const { Util } = require('../util.js');

class LogHelper {
    constructor(config) {
        const log_dir = Util.get_log_dir(config);

        blog.enable_file_log({
            name: 'dcrm_btc_index',
            dir: log_dir,
            file_max_size: 20 * 1024 * 1024,
            file_max_count: 100,
        });
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
