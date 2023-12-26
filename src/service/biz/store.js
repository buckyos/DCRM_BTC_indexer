const Database = require('better-sqlite3');

const DB_PATH = './data/inscribe.db';

class Store {
    constructor() {
        this.m_db = null;
    }

    init() {
        if (this.m_db) {
            return true;
        }

        this.m_db = new Database(DB_PATH, { fileMustExist: true });

        console.info('init db success');
    }

    get db() {
        return this.m_db;
    }
}

const store = new Store();
store.init();

module.exports = {
    store
};