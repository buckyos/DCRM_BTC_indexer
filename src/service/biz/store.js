const Database = require('better-sqlite3');
const path = require('path');
const INDEX_CONFIG = require('../../../config');

class Store {
    constructor() {
        this.m_indexDB = null;
        this.m_ethDB = null;
        this.m_inscriptionDB = null;
    }

    init() {
        // if init failed, let it crash

        const indexDBPath = path.join(INDEX_CONFIG.db.data_dir, INDEX_CONFIG.db.index_db_file);
        this.m_indexDB = new Database(indexDBPath, { /*fileMustExist: true,*/ readonly: true });

        const ethDBPath = path.join(INDEX_CONFIG.db.data_dir, INDEX_CONFIG.db.eth_db_file);
        this.m_ethDB = new Database(ethDBPath, { readonly: true });

        const inscriptionDBPath = path.join(INDEX_CONFIG.db.data_dir, INDEX_CONFIG.db.inscription_db_file);
        this.m_inscriptionDB = new Database(inscriptionDBPath, { readonly: true });

        logger.info('init db success');
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
store.init();

const TABLE_NAME = {
    INSCRIBE: "inscribe_data",
    RESONANCE: "data_resonance",
    CHANT: "data_chant",
    MINT: "mint_records",
    BALANCE: "balance",
    STATE: 'state',
};

module.exports = {
    store,
    TABLE_NAME
};