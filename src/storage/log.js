const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

class InscriptionLog {
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
        assert(this.log_collection == null, `log collection should be null`);
        assert(
            this.state_collection == null,
            `state collection should be null`,
        );

        try {
            console.log(`Connecting to ${this.mongo_url}`);
            this.mongo_client = await MongoClient.connect(this.mongo_url);
            this.db = this.mongo_client.db('inscription_index');

            this.log_collection = this.db.collection('log');
            await this.log_collection.createIndex(
                { inscription_id: 1 },
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

    /**
     *
     * @returns {Promise<{ret: number, height: number}>}
     */
    async get_latest_block_height() {
        assert(
            this.state_collection != null,
            `state collection should not be null`,
        );

        try {
            const state = await this.state_collection.findOne({
                name: 'latest_block_height',
            });
            return {
                ret: 0,
                height: state ? state.value : 0,
            };
        } catch (error) {
            console.error('failed to get latest block height', error);
            return {
                ret: -1,
            };
        }
    }

    /**
     *
     * @param {*} block_height
     * @returns {Promise<{ret: number}>
     */
    async update_latest_block_height(block_height) {
        assert(
            Number.isInteger(block_height) && block_height >= 0,
            'block_height must be a non-negative integer',
        );
        assert(
            this.state_collection != null,
            `state collection should not be null`,
        );

        try {
            await this.state_collection.updateOne(
                { name: 'latest_block_height' },
                { $set: { value: block_height } },
                { upsert: true },
            );
            return {
                ret: 0,
            };
        } catch (error) {
            console.error('failed to update latest block height', error);
            return {
                ret: -1,
            };
        }
    }

    async log_inscription(
        block_height,
        inscription_index,
        txid,
        inscription_id,
        address,
        output_address,
        content,
    ) {
        assert(
            this.log_collection != null,
            `log collection should not be null`,
        );
        assert(
            Number.isInteger(block_height) && block_height >= 0,
            `block_height should be non-negative integer`,
        );
        assert(
            Number.isInteger(inscription_index) && inscription_index >= 0,
            `inscription_index should be non-negative integer`,
        );
        assert(_.isString(txid), `txid should be string`);
        assert(_.isString(inscription_id), `inscription_id should be string`);
        assert(_.isString(address), `address should be string`);
        assert(_.isString(output_address), `output_address should be string`);
        assert(typeof content === 'object', `content should be object`);

        try {
            await this.log_collection.updateOne(
                { inscription_id },
                {
                    $set: {
                        block_height,
                        inscription_index,
                        txid,
                        inscription_id,
                        address,
                        output_address,
                        content,
                    },
                },
                { upsert: true },
            );

            return {
                ret: 0,
            };
        } catch (error) {
            console.error('failed to log inscription', error);
            return {
                ret: -1,
            };
        }
    }
}