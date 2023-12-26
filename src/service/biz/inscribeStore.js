const { store } = require('./store');

class InscribeStore {
    constructor() {
    }

    // return null or data
    queryInscriptionByHash(hash) {
        const stmt = store.db.prepare('SELECT * FROM inscribe WHERE hash = ?');
        const ret = stmt.get(hash);

        logger.debug('queryInscriptionByHash:', hash, "ret:", ret);

        return ret;
    }

    //return {count, list}
    queryInscriptionByAddress(address, length, offset, order) {
        order = order == "ASC" ? "ASC" : "DESC";
        const countStmt = store.db.prepare('SELECT COUNT(*) AS count FROM inscribe WHERE address = ?');
        const countResult = countStmt.get(address);
        const count = countResult.count;

        const pageStmt = store.db.prepare(`SELECT * FROM inscribe WHERE address = ? ORDER BY block ${order} LIMIT ? OFFSET ?`);
        const list = pageStmt.all(address, length, offset);

        logger.debug('queryInscriptionByAddress:', address, offset, length, "ret:", count, list);

        return { count, list };
    }

    //[begin, end) return {count, list}
    queryInscriptionByBlock(beginBlock, endBlock, length, offset, order) {
        order = order == "ASC" ? "ASC" : "DESC";
        const countStmt = store.db.prepare('SELECT COUNT(*) AS count FROM inscribe WHERE block >= ? AND block < ?');
        const countResult = countStmt.get(beginBlock, endBlock);
        const count = countResult.count;

        const pageStmt = store.db.prepare(`SELECT * FROM inscribe WHERE block >= ? AND block < ? ORDER BY block ${order} LIMIT ? OFFSET ?`);
        const list = pageStmt.all(beginBlock, endBlock, length, offset);

        logger.debug('queryInscriptionByBlock:', beginBlock, endBlock, offset, length, "ret:", count, list);

        return { count, list };
    }

    // return {count, list}
    queryResonanceByHash(hash, length, offset, order) {
        order = order == "ASC" ? "ASC" : "DESC";
        const countStmt = store.db.prepare('SELECT COUNT(*) AS count FROM inscribe WHERE hash = ?');
        const countResult = countStmt.get(hash);
        const count = countResult.count;

        const pageStmt = store.db.prepare(`SELECT * FROM inscribe WHERE hash = ? ORDER BY block ${order} LIMIT ? OFFSET ?`);
        const list = pageStmt.all(hash, length, offset);

        logger.debug('queryResonanceByHash:', hash, offset, length, "ret:", count, list);

        return { count, list };
    }

    // return {count, list}
    queryResonanceByAddress(address, length, offset, order) {
        order = order == "ASC" ? "ASC" : "DESC";
        const countStmt = store.db.prepare('SELECT COUNT(*) AS count FROM inscribe WHERE address = ?');
        const countResult = countStmt.get(address);
        const count = countResult.count;

        const pageStmt = store.db.prepare(`SELECT * FROM inscribe WHERE address = ? ORDER BY block ${order} LIMIT ? OFFSET ?`);
        const list = pageStmt.all(address, length, offset);

        logger.debug('queryResonanceByAddress:', address, offset, length, "ret:", count, list);

        return { count, list };
    }

    // return {count, list}
    queryChantByHash(hash, length, offset, order) {
        order = order == "ASC" ? "ASC" : "DESC";
        const countStmt = store.db.prepare('SELECT COUNT(*) AS count FROM inscribe WHERE hash = ?');
        const countResult = countStmt.get(hash);
        const count = countResult.count;

        const pageStmt = store.db.prepare(`SELECT * FROM inscribe WHERE hash = ? ORDER BY block ${order} LIMIT ? OFFSET ?`);
        const list = pageStmt.all(hash, length, offset);

        logger.debug('queryChantByHash:', hash, offset, length, "ret:", count, list);

        return { count, list };
    }

    // return {count, list}
    queryChantByAddress(address, length, offset, order) {
        order = order == "ASC" ? "ASC" : "DESC";
        const countStmt = store.db.prepare('SELECT COUNT(*) AS count FROM inscribe WHERE address = ?');
        const countResult = countStmt.get(address);
        const count = countResult.count;

        const pageStmt = store.db.prepare(`SELECT * FROM inscribe WHERE address = ? ORDER BY block ${order} LIMIT ? OFFSET ?`);
        const list = pageStmt.all(address, length, offset);

        logger.debug('queryChantByAddress:', address, offset, length, "ret:", count, list);

        return { count, list };
    }
}

module.exports = {
    InscribeStore
};