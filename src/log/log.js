const { blog } = require('./blog/init.js');
const path = require('path');
const fs = require('fs');

class LogHelper {
    constructor(config) {
        const base_dir = process.platform === 'win32' ? 'C:\\logs' : '/var/log';
        let log_dir = path.join(base_dir, 'dcrm_brc_index');
        if (config.isolate) {
            log_dir = path.join(log_dir, config.isolate);
        }

        if (!fs.existsSync(log_dir)) {
            fs.mkdirSync(log_dir, { recursive: true });
        }

        blog.enable_file_log({
            name: 'dcrm_brc_index',
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
}


module.exports = {
    LogHelper,
};