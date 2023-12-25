const Database = require('better-sqlite3');
const DB_NAME = 'inscribe.db';

class InscribeStore() {
    constructor() {
        this.m_db = null;
        this._initDB();
    }

    _initDB() {
        if (this.m_db) {
            return true;
        }
        try {
            this.m_db = new Database(DB_NAME, { fileMustExist: true });
            return true;
        } catch (err) {
            console.warn('open db failed:', err);
        }

        return false;
    }

    queryInscriptionByHash(hash) {
        if (!this._initDB()) {
            return null;
        }
        const sql = `SELECT * FROM inscription WHERE hash = ${hash};`;
        const stmt = this.m_db.prepare(sql);
        return stmt.all();
    }

    queryInscriptionByAddress(address) {
        if (!this._initDB()) {
            return null;
        }
        const sql = `SELECT * FROM inscription WHERE address = ${address};`;
        const stmt = this.m_db.prepare(sql);
        return stmt.all();
    }
}