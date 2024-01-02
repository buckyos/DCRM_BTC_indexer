const Database = require('better-sqlite3');
const path = require('path');
const { STATE_DB_FILE, TOKEN_INDEX_DB_FILE } = require('../../constants');

class Store {
    constructor() {
        this.m_dataDir = null;

        this.m_indexDB = null;
        this.m_stateDB = null;

        this.m_inited = false;
    }

    init(config) {
        if (this.m_inited) {
            return;
        }

        this.m_dataDir = config.dataDir;

        // if init failed, let it crash
        const option = {
            readonly: true,
            //verbose: console.log,
            //fileMustExist: true,
        }

        const indexDBPath = path.join(this.m_dataDir, TOKEN_INDEX_DB_FILE);
        this.m_indexDB = new Database(indexDBPath, option);

        const stateDBPath = path.join(this.m_dataDir, STATE_DB_FILE);
        this.m_stateDB = new Database(stateDBPath, option);

        logger.info('init db success');

        this.m_inited = true;
    }

    get indexDB() {
        return this.m_indexDB;
    }

    get stateDB() {
        return this.m_stateDB;
    }
}

const store = new Store();

const TABLE_NAME = {
    INSCRIBE: "inscribe_data",
    RESONANCE: "resonance_records",
    CHANT: "chant_records",
    MINT: "mint_records",
    BALANCE: "balance",
    STATE: 'state',
};

module.exports = {
    store,
    TABLE_NAME
};