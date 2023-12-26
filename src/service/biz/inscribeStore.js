const Database = require('better-sqlite3');

const DB_PATH = './data/inscribe.db';

class InscribeStore {
    constructor() {
        this.m_db = null;
        // for test
        /*this.m_db = new Database(DB_PATH);
        this.m_db.exec(`CREATE TABLE IF NOT EXISTS inscribe (
            hash VARCHAR(64) UNIQUE PRIMARY KEY NOT NULL,
            address varchar(45) not null,
            balance varchar(64) not null,
            price varchar(64) not null,
            block INT NOT NULL,
            resonance_count INT NOT NULL DEFAULT 0
        );`);

        this.m_db.exec(`CREATE INDEX IF NOT EXISTS inscribe_address ON inscribe(address);`);
        this.m_db.exec(`CREATE INDEX IF NOT EXISTS inscribe_block ON inscribe(block);`);
        try {
            let insertStmt = this.m_db.prepare(`INSERT INTO inscribe (hash, address, balance, price, block, resonance_count) VALUES (?, ?, ?, ?, ?, ?)`);
            let insertResult = insertStmt.run('abc123', '0xaddr123', '0', '0', 555, 0);
            insertStmt = this.m_db.prepare(`INSERT INTO inscribe (hash, address, balance, price, block, resonance_count) VALUES (?, ?, ?, ?, ?, ?)`);
            insertResult = insertStmt.run('abc234', '0xaddr234', '10', '0', 560, 1);
            insertStmt = this.m_db.prepare(`INSERT INTO inscribe (hash, address, balance, price, block, resonance_count) VALUES (?, ?, ?, ?, ?, ?)`);
            insertResult = insertStmt.run('abc345', '0xaddr345', '100', '0', 570, 2);
        } catch (error) {

        }*/
        // for test

        this._initDB();
    }

    _initDB() {
        if (this.m_db) {
            return true;
        }
        try {
            this.m_db = new Database(DB_PATH, { fileMustExist: true });
            return true;
        } catch (err) {
            console.warn('open db failed:', err);
        }

        return false;
    }

    // return null or data
    queryInscriptionByHash(hash) {
        if (!this._initDB()) {
            return null;
        }
        const stmt = this.m_db.prepare('SELECT * FROM inscribe WHERE hash = ?');
        const ret = stmt.get(hash);

        logger.debug('queryInscriptionByHash:', ret);

        return ret;
    }

    //return {count, list}
    queryInscriptionByAddress(address, offset, length) {
        if (!this._initDB()) {
            return null;
        }
        const countStmt = this.m_db.prepare('SELECT COUNT(*) AS count FROM inscribe WHERE address = ?');
        const countResult = countStmt.get(address);
        const count = countResult.count;

        const pageStmt = this.m_db.prepare(`SELECT * FROM inscribe WHERE address = ? LIMIT ? OFFSET ?`);
        const list = pageStmt.all(address, length, offset);

        logger.debug('queryInscriptionByAddress:', count, list);

        return { count, list };
    }
}

module.exports = {
    InscribeStore
};