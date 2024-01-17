const { ERR_CODE, makeResponse, makeSuccessResponse } = require('./util');
const { BTCClient } = require('../../btc/btc');

class ChainService {
    constructor(config) {
        this.m_config = config;
        this.m_btcClient = null;
    }

    _init() {
        if (!this.m_btcClient) {
            this.m_btcClient = BTCClient.new_from_config(this.m_config.config);
        }
    }

    async _getLastBtcBlockHeight() {
        try {
            this._init();
            const { ret, height } = await this.m_btcClient.get_latest_block_height();
            if (ret !== 0) {
                logger.warn('get btc block height failed. ret:', ret);
                return makeResponse(ret);
            }

            return makeSuccessResponse(height);

        } catch (error) {
            logger.error('get btc block height failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    async _getTx(ctx) {
        try {
            this._init();
            const { txid } = ctx.params;
            const { ret, tx } = await this.m_btcClient.get_transaction(txid);
            if (ret !== 0) {
                logger.warn('get btc tx failed. ret:', ret);
                return makeResponse(ERR_CODE.UNKNOWN_ERROR);
            }

            return makeSuccessResponse(tx);

        } catch (error) {
            logger.error('get btc tx failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR, error.message);
        }
    }

    async _getUtxoByInscriptionId(ctx) {
        const inscriptionId = ctx.params.inscription_id;
        if (!inscriptionId) {
            return makeResponse(ERR_CODE.INVALID_PARAM);
        }

        try {
            const url = `http://localhost:${this.m_config.localInterface.port}/utxo/${inscriptionId}`;
            const response = await fetch(url);

            if (response.status != 200) {
                return makeResponse(ERR_CODE.UNKNOWN_ERROR, response.statusText);
            }

            const json = await response.json();
            console.log(json);

            return makeSuccessResponse(json);

        } catch (error) {
            logger.error('_getUtxoByInscriptionId failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    async _getBlockByHeight(ctx) {
        try {
            this._init();
            const blockHeight = parseInt(ctx.params.block_height);
            const { ret, block } = await this.m_btcClient.get_block(blockHeight);
            if (ret !== 0) {
                logger.warn('get btc block failed. ret:', ret);
                return makeResponse(ERR_CODE.UNKNOWN_ERROR);
            }

            return makeSuccessResponse(block);

        } catch (error) {
            logger.error('get btc block failed:', error);

            return makeResponse(ERR_CODE.UNKNOWN_ERROR);
        }
    }

    registerRouter(router) {
        router.get("/btc/block_height", async (ctx) => {
            ctx.response.body = await this._getLastBtcBlockHeight();
        });

        router.get("/eth/block_height", async (ctx) => {
            ctx.response.body = makeResponse(ERR_CODE.NOT_IMPLEMENTED);
        });

        router.get("/btc/tx/:txid", async (ctx) => {
            ctx.response.body = await this._getTx(ctx);
        });

        router.get("/btc/block/:block_height", async (ctx) => {
            ctx.response.body = await this._getBlockByHeight(ctx);
        });
    }
}

module.exports = {
    ChainService,
};