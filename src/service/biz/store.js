const Database = require('better-sqlite3');
const path = require('path');
const { SYNC_STATE_DB_FILE, INDEX_STATE_DB_FILE, TOKEN_INDEX_DB_FILE } = require('../../constants');

class Store {
    constructor() {
        this.m_dataDir = null;

        this.m_indexDB = null;
        this.m_syncStateDB = null;
        this.m_indexStateDB = null;

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
        };

        const indexDBPath = path.join(this.m_dataDir, TOKEN_INDEX_DB_FILE);
        this.m_indexDB = new Database(indexDBPath, option);

        const syncStateDBPath = path.join(this.m_dataDir, SYNC_STATE_DB_FILE);
        this.m_syncStateDB = new Database(syncStateDBPath, option);

        const indexStateDBPath = path.join(this.m_dataDir, INDEX_STATE_DB_FILE);
        this.m_indexStateDB = new Database(indexStateDBPath, option);

        logger.info('init db success');

        this.m_inited = true;
    }

    get indexDB() {
        return this.m_indexDB;
    }

    get syncStateDB() {
        return this.m_syncStateDB;
    }

    get indexStateDB() {
        return this.m_indexStateDB;
    }
}

const store = new Store();

const TABLE_NAME = {
    INSCRIBE_DATA: 'inscribe_data',
    BALANCE: 'balance',
    STATE: 'state',
    relations: 'relations',

    RESONANCE_RECORDS: 'resonance_records',
    CHANT_RECORDS: 'chant_records',
    MINT_RECORDS: 'mint_records',
    INSCRIBE_RECORDS: 'inscribe_records',
    TRANSFER_RECORDS: 'transfer_records',
    SET_PRICE_RECORDS: 'set_price_records',
    INSCRIBE_DATA_TRANSFER_RECORDS: 'inscribe_data_transfer_records',

    USER_OPS: 'user_ops',
};

module.exports = {
    store,
    TABLE_NAME,
};
