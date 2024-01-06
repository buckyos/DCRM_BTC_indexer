const { ERR_CODE, makeReponse, makeSuccessReponse } = require('./util');
const { BTCClient } = require('../../btc/btc');

class ChainService {
    constructor(config) {
        this.m_config = config;
        this.m_btcClient = null;
    }

    _init() {
        if (!this.m_btcClient) {
            const { host, network, auth } = this.m_config.btcConfig;

            this.m_btcClient = new BTCClient(
                host,
                network,
                auth,
            );
        }
    }

    async _getLastBtcBlockHeight() {
        try {
            this._init();
            const { ret, height } = await this.m_btcClient.get_latest_block_height();
            if (ret !== 0) {
                logger.warn('get btc block height failed. ret:', ret);
                return makeReponse(ret);
            }

            return makeSuccessReponse(height);

        } catch (error) {
            logger.error('get btc block height failed:', error);

            return makeReponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    async _getTx(ctx) {
        try {
            this._init();
            const { txid } = ctx.params;
            const { ret, tx } = await this.m_btcClient.get_transaction(txid);
            if (ret !== 0) {
                logger.warn('get btc tx failed. ret:', ret);
                return makeReponse(ERR_CODE.UNKNOWN_ERROR);
            }

            return makeSuccessReponse(tx);

        } catch (error) {
            logger.error('get btc tx failed:', error);

            return makeReponse(ERR_CODE.UNKNOWN_ERROR, error.message);
        }
    }

    registerRouter(router) {
        router.get("/btc/block_height", async (ctx) => {
            ctx.response.body = await this._getLastBtcBlockHeight();
        });

        router.get("/block_height/eth", async (ctx) => {
            ctx.response.body = makeReponse(ERR_CODE.NOT_IMPLEMENTED);
        });

        router.get("/btc/tx/:txid", async (ctx) => {
            ctx.response.body = await this._getTx(ctx);
        });
    }
}

module.exports = {
    ChainService,
};