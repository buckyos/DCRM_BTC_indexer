const path = require('path');
const assert = require('assert');
const sqlite3 = require('sqlite3').verbose();
const { TOKEN_INDEX_DB_FILE } = require('../constants');

const UserHashRelation = {
    Owner: 0,
    Resonance: 1,
};

class UserHashRelationStorage {
    constructor(data_dir) {
        assert(
            typeof data_dir === 'string',
            `data_dir should be string: ${data_dir}`,
        );

        this.db_file_path = path.join(data_dir, TOKEN_INDEX_DB_FILE);
        this.db = null;
    }

    async init() {
        assert(this.db == null, `UserHashRelationStorage db should be null`);

        return new Promise((resolve) => {
            assert(
                this.db == null,
                `UserHashRelationStorage db should be null`,
            );
            this.db = new sqlite3.Database(this.db_file_path, (err) => {
                if (err) {
                    console.error(
                        `failed to connect to UserHashRelationStorage sqlite: ${err}`,
                    );
                    resolve({ ret: -1 });
                    return;
                }

                console.log(`Connected to ${this.db_file_path}`);
                this._init_tables().then(({ ret }) => {
                    resolve({ ret });
                });
            });
        });
    }

    async _init_tables() {
        assert(this.db != null, `db should not be null`);

        return new Promise((resolve) => {
            this.db.serialize(() => {
                let has_error = false;

                // Create inscription_transfers table
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS relations (
                        address TEXT,
                        hash TEXT,
                        relation INTEGER,
                        PRIMARY KEY (address, hash)
                    );`,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to create relations table: ${err}`,
                            );

                            has_error = true;
                            resolve({ ret: -1 });
                            return;
                        }
                        console.log(`created relations table`);
                    },
                );

                if (has_error) {
                    return;
                }
                // create index on block_height
                this.db.run(
                    `CREATE INDEX IF NOT EXISTS idx_relations_address ON relations (address);
                    CREATE INDEX IF NOT EXISTS idx_relations_hash ON relations (hash);`,
                    (err) => {
                        if (err) {
                            console.error(
                                `failed to create index on relations table: ${err}`,
                            );

                            has_error = true;
                            resolve({ ret: -1 });
                        }

                        console.log(`created index on relations table`);
                        resolve({ ret: 0 });
                    },
                );
            });
        });
    }

    /**
     * 
     * @param {string} address 
     * @param {string} hash 
     * @param {UserHashRelation} relation 
     * @returns {Promise<{ret: number}>} 
     */
    async insert_relation(address, hash, relation) {
        assert(this.db != null, `db should not be null`);
        assert(_.isString(address), `address should be string: ${address}`);
        assert(_.isString(hash), `hash should be string: ${hash}`);
        assert(_.isNumber(relation), `relation should be number: ${relation}`);

        return new Promise((resolve) => {
            this.db.run(
                `INSERT INTO relations(address, hash, relation) VALUES(?, ?, ?)`,
                [address, hash, relation],
                function (err) {
                    if (err) {
                        console.error(`failed to insert relation: ${address} ${hash} ${relation} ${err}`);
                        resolve({ ret: -1 });
                    } else {
                        resolve({
                            ret: 0,
                        });
                    }
                },
            );
        });
    }

    /**
     * @comment query relation from address with hash
     * @param {string} address 
     * @param {string} hash 
     * @returns {Promise<{ret: number, data: {address: string, hash: string, relation: UserHashRelation}}>}
     */
    async query_relation(address, hash) {
        assert(this.db != null, `db should not be null`);
        assert(_.isString(address), `address should be string: ${address}`);
        assert(_.isString(hash), `hash should be string: ${hash}`);

        return new Promise((resolve) => {
            this.db.get(
                `SELECT * FROM relations WHERE address = ? AND hash = ?`,
                [address, hash],
                (err, row) => {
                    if (err) {
                        console.error(`failed to query relation: ${address} ${hash} ${err}`);
                        resolve({ ret: -1 });
                    } else {
                        if (row == null) {
                            resolve({ ret: 0, data: null });
                        } else {
                            resolve({ ret: 0, data: row });
                        }
                    }
                },
            );
        });
    }

    /**
     * @comment update relation from resonance to owner if exists
     */
    async update_to_owner(address, hash) {
        assert(this.db != null, `db should not be null`);
        assert(_.isString(address), `address should be string: ${address}`);
        assert(_.isString(hash), `hash should be string: ${hash}`);

        return new Promise((resolve) => {
            this.db.run(
                `UPDATE relations SET relation = ? WHERE address = ? AND hash = ? AND relation = ?`,
                [UserHashRelation.Owner, address, hash, UserHashRelation.Resonance],
                function (err) {
                    if (err) {
                        console.error(`failed to update relation: ${address} ${hash} ${err}`);
                        resolve({ ret: -1 });
                    } else {
                        resolve({
                            ret: 0,
                        });
                    }
                },
            );
        });
    }

    /**
     * @comment transfer owner from from_address to to_address
     * @param {string} from_address 
     * @param {string} to_address 
     * @param {string} hash 
     * @returns {Promise<{ret: number}>}
     */
    async transfer_owner(from_address, to_address, hash) {
        assert(this.db != null, `db should not be null`);
        assert(_.isString(from_address), `from_address should be string: ${from_address}`);
        assert(_.isString(to_address), `to_address should be string: ${to_address}`);
        assert(_.isString(hash), `hash should be string: ${hash}`);

        // first delete new owner's relation if exists
        const { ret: delete_ret } = await this.delete_resonance(to_address, hash);
        if (delete_ret !== 0) {
            console.error(`failed to delete relation: ${to_address} ${hash}`);
            return { ret: delete_ret };
        }

        return new Promise((resolve) => {
            this.db.run(
                `UPDATE relations SET address = ? WHERE address = ? AND hash = ? AND relation = ?`,
                [to_address, from_address, hash, UserHashRelation.Owner],
                function (err) {
                    if (err) {
                        console.error(`failed to update relation: ${from_address} ${to_address} ${hash} ${err}`);
                        resolve({ ret: -1 });
                    } else {
                        resolve({
                            ret: 0,
                        });
                    }
                },
            );
        });
    }

    async get_resonances_by_hash(hash) {
        assert(this.db != null, `db should not be null`);
        assert(_.isString(hash), `hash should be string: ${hash}`);

        return new Promise((resolve) => {
            this.db.all(
                `SELECT * FROM relations WHERE hash = ? AND relation = ?`,
                [hash, UserHashRelation.Resonance],
                (err, rows) => {
                    if (err) {
                        console.error(`failed to get resonances by hash: ${hash} ${err}`);
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0, data: rows });
                    }
                },
            );
        });
    }

    async get_resonances_by_address(address) {
        assert(this.db != null, `db should not be null`);
        assert(_.isString(address), `address should be string: ${address}`);

        return new Promise((resolve) => {
            this.db.all(
                `SELECT * FROM relations WHERE address = ? AND relation = ?`,
                [address, UserHashRelation.Resonance],
                (err, rows) => {
                    if (err) {
                        console.error(`failed to get resonances by address: ${address} ${err}`);
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0, data: rows });
                    }
                },
            );
        });
    }

    /**
     * @comment get resonance count by hash
     * @param {string} hash 
     * @returns {Promise<{ret: number, count: number}>}
     */
    async get_resonance_count_by_hash(hash) {
        assert(this.db != null, `db should not be null`);
        assert(_.isString(hash), `hash should be string: ${hash}`);

        return new Promise((resolve) => {
            this.db.get(
                `SELECT COUNT(*) as count FROM relations WHERE hash = ? AND relation = ?`,
                [hash, UserHashRelation.Resonance],
                (err, row) => {
                    if (err) {
                        console.error(`failed to get resonance count by hash: ${hash} ${err}`);
                        resolve({ ret: -1 });
                    } else {
                        resolve({ ret: 0, count: row.count });
                    }
                },
            );
        });
    }

    async delete_resonance(address, hash) {
        assert(this.db != null, `db should not be null`);
        assert(_.isString(address), `address should be string: ${address}`);
        assert(_.isString(hash), `hash should be string: ${hash}`);

        return new Promise((resolve) => {
            this.db.run(
                `DELETE FROM relations WHERE address = ? AND hash = ?`,
                [address, hash],
                function (err) {
                    if (err) {
                        console.error(`failed to delete relation: ${address} ${hash} ${err}`);
                        resolve({ ret: -1 });
                    } else {
                        if (this.changes === 0) {
                            console.info(`No relation found: ${address} ${hash}`);
                            resolve({
                                ret: 0,
                            });
                        } else {
                            resolve({
                                ret: 0,
                            });
                        }
                    }
                },
            );
        });
    }

    async delete_resonances_by_address(address) {
        assert(this.db != null, `db should not be null`);
        assert(_.isString(address), `address should be string: ${address}`);

        return new Promise((resolve) => {
            this.db.run(
                `DELETE FROM relations WHERE address = ? AND relation = ?`,
                [address, UserHashRelation.Resonance],
                function (err) {
                    if (err) {
                        console.error(`failed to delete relation with address: ${address} ${err}`);
                        resolve({ ret: -1 });
                    } else {
                        if (this.changes === 0) {
                            console.warn(`No relation found: ${address}`);
                            resolve({
                                ret: 0,
                            });
                        } else {
                            resolve({
                                ret: 0,
                                value: 'Relations deleted successfully',
                            });
                        }
                    }
                },
            );
        });
    }
}

module.exports = {UserHashRelationStorage, UserHashRelation};