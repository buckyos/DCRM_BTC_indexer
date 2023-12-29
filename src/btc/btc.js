const Client = require('bitcoin-core');
const fs = require('fs');
const { Util } = require('../util');
const { LRUCache } = require('lru-cache');

// add lru cache for tx
class TxCache {
    constructor() {
        this.cache = new LRUCache ({
            max: 1024 * 512,
            maxAge: 1000 * 60 * 60 * 24,
        });
    }

    get(txid) {
        return this.cache.get(txid);
    }

    set(txid, tx) {
        this.cache.set(txid, tx);
    }
}

class BTCClient {
    constructor(host, network, auth) {
        if (auth.cookie_file) {
            const [username, password] = fs
                .readFileSync(auth.cookie_file, 'utf8')
                .split(':');
            auth.username = username;
            auth.password = password;
        } else if (auth.cookie) {
            const [username, password] = auth.cookie.split(':');
            auth.username = username;
            auth.password = password;
        }

        this.client = new Client({
            host,
            network,
            username: auth.username,
            password: auth.password,
            timeout: 1000 * 30,
        });

        this.retry_count = 3;
        this.tx_cache = new TxCache();
    }

    _should_retry(error) {
        return (
            error.code == `ETIMEDOUT` ||
            error.code == `ECONNREFUSED` ||
            error.code == `ECONNRESET`
        );
    }

    /**
     *
     * @returns {Promise<{ret: number, height: number}>}
     */
    async get_latest_block_height() {
        for (let i = 0; i < this.retry_count; i++) {
            const { ret, height, error } =
                await this._get_latest_block_height();
            if (ret === 0) {
                return { ret, height };
            }

            if (this._should_retry(error)) {
                console.error(
                    `failed to get latest block height, retrying ${i}`,
                );
                await Util.sleep(1000 * 2);
                continue;
            }
        }

        return { ret: -1 };
    }

    async _get_latest_block_height() {
        try {
            const blockCount = await this.client.getBlockCount();
            return {
                ret: 0,
                height: blockCount,
            };
        } catch (error) {
            console.error('failed to get block count', error);
            return {
                ret: -1,
                error,
            };
        }
    }

    /**
     *
     * @param {string} txid
     * @returns {Promise<{ret: number, tx: object}>}
     */
    async get_transaction(txid) {
        // first check cache
        const cached_tx = this.tx_cache.get(txid);
        if (cached_tx != null) {
            return { ret: 0, tx: cached_tx };
        }

        // not found in cache, fetch from bitcoind rpc server
        for (let i = 0; i < this.retry_count; i++) {
            const { ret, tx, error } = await this._get_transaction(txid);
            if (ret === 0) {
                return { ret, tx };
            }

            if (this._should_retry(error)) {
                console.error(
                    `failed to get transaction ${txid}, retrying ${i}`,
                );
                await Util.sleep(1000 * 2);
                continue;
            }
        }

        return { ret: -1 };
    }

    async _get_transaction(txid) {
        try {
            const tx = await this.client.getRawTransaction(txid, true);
            this.tx_cache.set(txid, tx);
            return {
                ret: 0,
                tx: tx,
            };
        } catch (error) {
            console.error(`failed to get transaction ${txid}, ${error}`);
            return {
                ret: -1,
                error,
            };
        }
    }

    /**
     *
     * @param {number} block_height
     * @returns {Promise<{ret: number, block: object}>}
     */
    async get_block(block_height) {
        for (let i = 0; i < this.retry_count; i++) {
            const { ret, block, error } = await this._get_block(block_height);
            if (ret === 0) {
                return { ret, block };
            }

            if (this._should_retry(error)) {
                console.error(
                    `failed to get block ${block_height}, retrying ${i}`,
                );
                await Util.sleep(1000 * 2);
                continue;
            }
        }

        return { ret: -1 };
    }

    async _get_block(block_height) {
        try {
            const blockhash = await this.client.getBlockHash(block_height);
            const block = await this.client.getBlock(blockhash);
            return { ret: 0, block };
        } catch (err) {
            console.error(`failed to get block ${blockhash}, ${err}`);
            return { ret: -1, error: err };
        }
    }
}

module.exports = { BTCClient };
