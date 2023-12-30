const assert = require('assert');

const blog = require('./blog.js').blog;

blog.console = console;

global.blog = blog;

function patch_console(log) {
    // keep oringin console methods
    console.origin = {};
    console.origin.trace = console.trace;
    console.origin.debug = console.debug;
    console.origin.log = console.log;
    console.origin.info = console.info;

    console.origin.warn = console.warn;
    console.origin.error = console.error;

    console.origin.assert = console.assert;
    console.origin.time = console.time;
    console.origin.timeEnd = console.timeEnd;

    console.trace = log.trace;
    console.debug = log.debug;
    console.log = log.info;
    console.info = log.info;

    console.warn = log.warn;
    console.error = log.error;

    console.assert = log.assert;
}

function restore_console() {
    const origin = console.origin;
    console.trace = origin.trace;
    console.debug = origin.debug;
    console.log = origin.info;
    console.info = origin.info;

    console.warn = origin.warn;
    console.error = origin.error;

    console.assert = origin.assert;
}

/*
export interface LogFileOptions {
    name: string,
    dir: string,
    file_max_size?: number,
    file_max_count?: number,
}
*/

blog.enable_file_log = (options) => {
    const log_options = {};
    console.assert(options.name.length > 0);
    log_options.filename = options.name;

    assert(
        options.dir != null || options.dir.length > 0,
        `invalid dir ${options.dir}`,
    );
    log_options.rootFolder = options.dir;

    if (options.file_max_size != null) {
        log_options.filemaxsize = options.file_max_size;
    }
    if (options.file_max_count != null) {
        log_options.filemaxcount = options.file_max_count;
    }
    blog.addFileTarget(log_options);
};

blog.restore_console = restore_console;
blog.patch_console = patch_console.bind(undefined, blog);

module.exports = { blog };
