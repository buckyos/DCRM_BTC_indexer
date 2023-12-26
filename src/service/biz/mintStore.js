const { store } = require('./store');

class MintStore {
    constructor() {
    }

    // return null or data
    queryMintRecordByHash(hash) {
        // const stmt = store.db.prepare('SELECT * FROM mint WHERE hash = ?');
        // const ret = stmt.get(hash);

        // logger.debug('queryInscriptionByHash:', hash, "ret:", ret);

        return null;
    }

    //return {count, list}
    queryMintRecordByAddress(address, length, offset, order) {
        order = order == "ASC" ? "ASC" : "DESC";
        const countStmt = store.db.prepare('SELECT COUNT(*) AS count FROM mint WHERE address = ?');
        const countResult = countStmt.get(address);
        const count = countResult.count;

        const pageStmt = store.db.prepare(`SELECT * FROM mint WHERE address = ? ORDER BY timestamp ${order} LIMIT ? OFFSET ?`);
        const list = pageStmt.all(address, length, offset);

        logger.debug('queryMintRecordByAddress:', address, offset, length, "ret:", count, list);

        return { count, list };
    }

    queryLuckyMintRecord(length, offset, order) {
        order = order == "ASC" ? "ASC" : "DESC";
        const countStmt = store.db.prepare('SELECT COUNT(*) AS count FROM mint WHERE lucky is not null');
        const countResult = countStmt.get();
        const count = countResult.count;

        const pageStmt = store.db.prepare(`SELECT * FROM mint WHERE lucky is not null ORDER BY timestamp ${order} LIMIT ? OFFSET ?`);
        const list = pageStmt.all(length, offset);

        logger.debug('queryLuckyMintRecord:', offset, length, "ret:", count, list);

        return { count, list };
    }
}

module.exports = {
    MintStore
};