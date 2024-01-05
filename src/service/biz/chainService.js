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

    registerRouter(router) {
        router.get("/block_height/btc", async (ctx) => {
            ctx.response.body = await this._getLastBtcBlockHeight();
        });

        router.get("/block_height/eth", async (ctx) => {
            ctx.response.body = makeReponse(ERR_CODE.NOT_IMPLEMENTED);
        });
    }
}

module.exports = {
    ChainService,
};