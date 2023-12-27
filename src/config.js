const path = require('path');
const fs = require('fs');
const assert = require('assert');

class Config {
    constructor(config_file) {
        this.config_file = config_file;
        console.info(`Loading config file: ${config_file}`);

        this.config = require(config_file);

        assert(this.config.isolate, `isolate should be set`);
        assert(this.config.eth.contract_abi, `contract_abi should be set`);

        console.log(JSON.stringify(this.config));

        // load abi file from config file in the same dir
        const abi_file = path.join(
            path.dirname(config_file),
            this.config.eth.contract_abi,
        );
        assert(fs.existsSync(abi_file));
        this.config.eth.contract_abi = require(abi_file);
    }
}

module.exports = { Config };