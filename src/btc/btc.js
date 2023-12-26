const Client = require('bitcoin-core');
const fs = require('fs');

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
        });
    }

    /**
     *
     * @returns {Promise<{ret: number, height: number}>}
     */
    async get_latest_block_height() {
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
            };
        }
    }

    async get_transaction(txid) {
        try {
            const tx = await this.client.getRawTransaction(txid, true);
            return {
                ret: 0,
                tx: tx,
            };
        } catch (error) {
            console.error(`failed to get transaction ${txid}, ${error}`);
            return {
                ret: -1,
            };
        }
    }

    /**
     * @returns {Promise<{ret: number, txs: []}>}
     */
    async get_transactions_by_address(address) {
        try {
            const txs = await this.client.searchRawTransactions(address);
            return {
                ret: 0,
                txs: txs,
            };
        } catch (error) {
            console.error('failed to get transactions', error);
            return {
                ret: -1,
            };
        }
    }
}

module.exports = { BTCClient };
