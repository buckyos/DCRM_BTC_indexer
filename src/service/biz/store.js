const Database = require('better-sqlite3');
const path = require('path');
const {
    SYNC_STATE_DB_FILE,
    INDEX_STATE_DB_FILE,
    TOKEN_INDEX_DB_FILE,
    INSCRIPTION_DB_FILE,
    ETH_INDEX_DB_FILE
} = require('../../constants');
const fs = require('fs');
const chokidar = require('chokidar');

class Store {
    constructor() {
        this.m_dataDir = null;

        this.m_indexDB = null;
        this.m_syncStateDB = null;
        this.m_indexStateDB = null;
        this.m_inscriptionDB = null;
        this.m_ethIndexDB = null;

        this.m_inited = false;

        this.m_watchers = [];
    }

    _connectDB(dbPath, option) {
        if (fs.existsSync(dbPath)) {
            try {
                const db = new Database(dbPath, option);
                logger.info(`Connected to database at ${dbPath}`);

                return db;
            } catch (error) {
                logger.error(`Failed to connect to database at ${dbPath}: ${error}`);
                return null;
            }
        } else {
            logger.warn(`Database file at ${dbPath} does not exist.`);
            return null;
        }
    }

    _watchAndReconnect(dbPath, dbName, option) {
        const watcher = chokidar.watch(dbPath, { ignoreInitial: true });
        watcher.on('add', (path) => {
            logger.info(`Reconnecting to the new database file: ${path}`);
            if (this[dbName]) {
                this[dbName].close();
                this[dbName] = null;
            }
            this[dbName] = this._connectDB(dbPath, option);
        });
        this.m_watchers.push(watcher);
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
        this.m_indexDB = this._connectDB(indexDBPath, option);
        this._watchAndReconnect(indexDBPath, 'm_indexDB', option);

        const syncStateDBPath = path.join(this.m_dataDir, SYNC_STATE_DB_FILE);
        this.m_syncStateDB = this._connectDB(syncStateDBPath, option);
        this._watchAndReconnect(syncStateDBPath, 'm_syncStateDB', option);

        const indexStateDBPath = path.join(this.m_dataDir, INDEX_STATE_DB_FILE);
        this.m_indexStateDB = this._connectDB(indexStateDBPath, option);
        this._watchAndReconnect(indexStateDBPath, 'm_indexStateDB', option);

        const inscriptionDBPath = path.join(this.m_dataDir, INSCRIPTION_DB_FILE);
        this.m_inscriptionDB = this._connectDB(inscriptionDBPath, option);
        this._watchAndReconnect(inscriptionDBPath, 'm_inscriptionDB', option);

        const ethIndexDBPath = path.join(this.m_dataDir, ETH_INDEX_DB_FILE);
        this.m_ethIndexDB = this._connectDB(ethIndexDBPath, option);
        this._watchAndReconnect(ethIndexDBPath, 'm_ethIndexDB', option);

        // logger.info('init db success');

        this.m_inited = true;
    }

    close() {
        this.m_watchers.forEach(watcher => watcher.close());

        ['m_indexDB', 'm_syncStateDB', 'm_indexStateDB', 'm_inscriptionDB', 'm_ethIndexDB'].forEach(dbName => {
            if (this[dbName]) {
                this[dbName].close();
                this[dbName] = null;
                console.log('close db:', dbName);
            }
        });
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

    get inscriptionDB() {
        return this.m_inscriptionDB;
    }

    get ethIndexDb() {
        return this.m_ethIndexDB;
    }
}

const TABLE_NAME = {
    INSCRIBE_DATA: 'inscribe_data',
    BALANCE: 'balance',
    BALANCE_RECORDS: 'balance_records',
    STATE: 'state',
    RELATIONS: 'relations',
    INSCRIPTIONS: 'inscriptions',

    RESONANCE_RECORDS: 'resonance_records',
    CHANT_RECORDS: 'chant_records',
    MINT_RECORDS: 'mint_records',
    INSCRIBE_RECORDS: 'inscribe_records',
    TRANSFER_RECORDS: 'transfer_records',
    SET_PRICE_RECORDS: 'set_price_records',
    INSCRIBE_DATA_TRANSFER_RECORDS: 'inscribe_data_transfer_records',

    USER_OPS: 'user_ops',
    POINTS: 'points'
};

module.exports = {
    Store,
    TABLE_NAME,
};
