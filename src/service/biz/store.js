const Database = require('better-sqlite3');
const path = require('path');

class Store {
    constructor() {
        this.m_dataDir = null;

        this.m_indexDB = null;
        this.m_ethDB = null;
        this.m_inscriptionDB = null;

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

        const dbConfig = config.dbConfig;

        const indexDBPath = path.join(this.m_dataDir, dbConfig.index_db_file);
        this.m_indexDB = new Database(indexDBPath, option);

        const ethDBPath = path.join(this.m_dataDir, dbConfig.eth_db_file);
        this.m_ethDB = new Database(ethDBPath, option);

        const inscriptionDBPath = path.join(this.m_dataDir, dbConfig.inscription_db_file);
        this.m_inscriptionDB = new Database(inscriptionDBPath, option);

        logger.info('init db success');

        this.m_inited = true;
    }

    get indexDB() {
        return this.m_indexDB;
    }

    get ethDB() {
        return this.m_ethDB;
    }

    get inscriptionDB() {
        return this.m_inscriptionDB;
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