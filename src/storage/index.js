const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

class TokenIndex {
    constructor(mongo_url) {
        assert(
            _.isString(mongo_url),
            `mongo_url should be string: ${mongo_url}`,
        );

        this.mongo_url = mongo_url;
        this.mongo_client = null;
    }

    async ensure_connection() {
        if (this.mongo_client == null) {
            const { ret } = await this.connect();
            if (ret !== 0) {
                console.error(`failed to connect to mongo`);
                return { ret };
            }
        }

        return { ret: 0 };
    }

    async connect() {
        assert(this.mongo_client == null, `mongo_client should be null`);
        assert(this.db == null, `db should be null`);
        assert(
            this.token_collection == null,
            `token collection should be null`,
        );
        assert(
            this.state_collection == null,
            `state collection should be null`,
        );

        try {
            console.log(`Connecting to ${this.mongo_url}`);
            this.mongo_client = await MongoClient.connect(this.mongo_url);
            this.db = this.mongo_client.db('token_index');

            this.token_collection = this.db.collection('token');
            await this.token_collection.createIndex(
                { token_id: 1 },
                { unique: true },
            );

            this.state_collection = this.db.collection('state');
            console.log(`Connected to ${this.mongo_url}`);

            return { ret: 0 };
        } catch (e) {
            console.error('failed to connect to mongo', e);
            return { ret: -1 };
        }
    }

    async start_transcation() {
        assert(this.mongo_client, 'mongo client should be connected');
        assert(this.session == null, 'session should be null');

        this.session = this.mongo_client.startSession();
        this.session.startTransaction();
    }

    async end_session(commit) {
        assert(this.session, 'session should not be null');

        if (commit) {
            await this.session.commitTransaction();
        } else {
            await this.session.abortTransaction();
        }

        await this.session.endSession();
        this.session = null;
    }
}

module.exports = { InscriptionLog };
