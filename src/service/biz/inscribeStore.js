const { store } = require('./store');

const INSCRIBE_TABLE = "inscribe_data";
const RESONANCE_TABLE = "data_resonance";
const CHANT_TABLE = "data_chant";
const BALANCE_TABLE = "balance";

class InscribeStore {
    constructor() {
    }

    // return null or data
    queryInscriptionByHash(hash) {
        const stmt = store.db.prepare(`SELECT * FROM ${INSCRIBE_TABLE} WHERE hash = ?`);
        const ret = stmt.get(hash);

        logger.debug('queryInscriptionByHash:', hash, "ret:", ret);

        return ret;
    }

    //return {count, list}
    queryInscriptionByAddress(address, length, offset, order) {
        order = order == "ASC" ? "ASC" : "DESC";
        const countStmt = store.db.prepare(`SELECT COUNT(*) AS count FROM ${INSCRIBE_TABLE} WHERE address = ?`);
        const countResult = countStmt.get(address);
        const count = countResult.count;

        const pageStmt = store.db.prepare(`SELECT * FROM ${INSCRIBE_TABLE} WHERE address = ? ORDER BY timestamp ${order} LIMIT ? OFFSET ?`);
        const list = pageStmt.all(address, length, offset);

        logger.debug('queryInscriptionByAddress:', address, offset, length, "ret:", count, list);

        return { count, list };
    }

    //[begin, end) return {count, list}
    queryInscriptionByBlock(beginBlock, endBlock, length, offset, order) {
        order = order == "ASC" ? "ASC" : "DESC";
        const countStmt = store.db.prepare(`SELECT COUNT(*) AS count FROM ${INSCRIBE_TABLE} WHERE block_height >= ? AND block_height < ?`);
        const countResult = countStmt.get(beginBlock, endBlock);
        const count = countResult.count;

        const pageStmt = store.db.prepare(`SELECT * FROM ${INSCRIBE_TABLE} WHERE block_height >= ? AND block_height < ? ORDER BY timestamp ${order} LIMIT ? OFFSET ?`);
        const list = pageStmt.all(beginBlock, endBlock, length, offset);

        logger.debug('queryInscriptionByBlock:', beginBlock, endBlock, offset, length, "ret:", count, list);

        return { count, list };
    }

    queryInscriptionCount() {
        const stmt = store.db.prepare(`SELECT COUNT(*) AS count FROM ${INSCRIBE_TABLE}`);
        const ret = stmt.get();
        const count = ret.count;

        logger.debug('queryInscriptionCount: ret:', count);

        return count;
    }

    // return {count, list}
    queryResonanceByHash(hash, length, offset, order) {
        order = order == "ASC" ? "ASC" : "DESC";
        const countStmt = store.db.prepare(`SELECT COUNT(*) AS count FROM ${RESONANCE_TABLE} WHERE hash = ?`);
        const countResult = countStmt.get(hash);
        const count = countResult.count;

        const pageStmt = store.db.prepare(`SELECT * FROM ${RESONANCE_TABLE} WHERE hash = ? ORDER BY block_height ${order} LIMIT ? OFFSET ?`);
        const list = pageStmt.all(hash, length, offset);

        logger.debug('queryResonanceByHash:', hash, offset, length, "ret:", count, list);

        return { count, list };
    }

    // return {count, list}
    queryResonanceByAddress(address, length, offset, order) {
        order = order == "ASC" ? "ASC" : "DESC";
        const countStmt = store.db.prepare(`SELECT COUNT(*) AS count FROM ${RESONANCE_TABLE} WHERE address = ?`);
        const countResult = countStmt.get(address);
        const count = countResult.count;

        const pageStmt = store.db.prepare(`SELECT * FROM ${RESONANCE_TABLE} WHERE address = ? ORDER BY block_height ${order} LIMIT ? OFFSET ?`);
        const list = pageStmt.all(address, length, offset);

        logger.debug('queryResonanceByAddress:', address, offset, length, "ret:", count, list);

        return { count, list };
    }

    // return {count, list}
    queryChantByHash(hash, length, offset, order) {
        order = order == "ASC" ? "ASC" : "DESC";
        const countStmt = store.db.prepare(`SELECT COUNT(*) AS count FROM ${CHANT_TABLE} WHERE hash = ?`);
        const countResult = countStmt.get(hash);
        const count = countResult.count;

        const pageStmt = store.db.prepare(`SELECT * FROM ${RESONANCE_TABLE} WHERE hash = ? ORDER BY block_height ${order} LIMIT ? OFFSET ?`);
        const list = pageStmt.all(hash, length, offset);

        logger.debug('queryChantByHash:', hash, offset, length, "ret:", count, list);

        return { count, list };
    }

    // return {count, list}
    queryChantByAddress(address, length, offset, order) {
        order = order == "ASC" ? "ASC" : "DESC";
        const countStmt = store.db.prepare(`SELECT COUNT(*) AS count FROM ${RESONANCE_TABLE} WHERE address = ?`);
        const countResult = countStmt.get(address);
        const count = countResult.count;

        const pageStmt = store.db.prepare(`SELECT * FROM ${RESONANCE_TABLE} WHERE address = ? ORDER BY block_height ${order} LIMIT ? OFFSET ?`);
        const list = pageStmt.all(address, length, offset);

        logger.debug('queryChantByAddress:', address, offset, length, "ret:", count, list);

        return { count, list };
    }
}

module.exports = {
    InscribeStore
};