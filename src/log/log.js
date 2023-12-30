const { blog } = require('./blog/init.js');
const path = require('path');
const fs = require('fs');

class LogHelper {
    constructor() {
        const base_dir = process.platform === 'win32' ? 'C:\\logs' : '/var/log';
        const log_dir = path.join(base_dir, 'dcrm_brc_index');
        if (!fs.existsSync(log_dir)) {
            fs.mkdirSync(log_dir, { recursive: true });
        }

        blog.enable_file_log({
            name: 'dcrm_brc_index',
            dir: log_dir,
            file_max_size: 20 * 1024 * 1024,
            file_max_count: 100,
        });

        blog.enableConsoleTarget(true);
    }

    path_console() {
        blog.patch_console();
    }
}


module.exports = {
    LogHelper,
};