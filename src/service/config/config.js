const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { Util } = require('../../util');

class Config {
    constructor() {
    }

    init(configFile) {
        this.m_configFile = configFile;
        console.info(`Loading config file: ${configFile}`);

        this.m_config = require(configFile);

        assert(this.m_config.isolate, `isolate should be set`);

        console.log(JSON.stringify(this.m_config));
    }

    get btcConfig() {
        if (!this.m_config) {
            throw new Error(`config not loaded`);
        }

        return this.m_config.btc;
    }

    get service() {
        if (!this.m_config) {
            throw new Error(`config not loaded`);
        }

        return this.m_config.service;
    }

    get dataDir() {
        if (!this.m_config) {
            throw new Error(`config not loaded`);
        }

        const { ret, dir } = Util.get_data_dir(this.m_config);
        if (ret !== 0) {
            throw new Error(`failed to get data dir`);
        }

        return dir;
    }

    get dbConfig() {
        if (!this.m_config) {
            throw new Error(`config not loaded`);
        }

        return this.m_config.db;
    }

    get localInterface() {
        if (!this.m_config) {
            throw new Error(`config not loaded`);
        }

        return this.m_config.interface;
    }

    get config() {
        if (!this.m_config) {
            throw new Error(`config not loaded`);
        }

        return this.m_config;
    }
}

const config = new Config();

module.exports = { config };
