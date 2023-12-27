const Database = require('better-sqlite3');
const path = require('path');
const INDEX_CONFIG = require('../../../config');

class Store {
    constructor() {
        this.m_db = null;
    }

    init() {
        if (this.m_db) {
            return true;
        }

        const dataPath = path.join(INDEX_CONFIG.db.data_dir, INDEX_CONFIG.db.index_db_file);

        this.m_db = new Database(dataPath, { /*fileMustExist: true,*/ readonly: true });

        console.info('init db success');
    }

    get db() {
        return this.m_db;
    }
}

const store = new Store();
store.init();

const TABLE_NAME = {
    INSCRIBE: "inscribe_data",
    RESONANCE: "data_resonance",
    CHANT: "data_chant",
    MINT: "mint_records",
    BALANCE: "balance"
};

module.exports = {
    store,
    TABLE_NAME
};