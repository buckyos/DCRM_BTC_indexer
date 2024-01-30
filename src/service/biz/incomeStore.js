const { TABLE_NAME } = require('./store');
const { ERR_CODE, makeResponse, makeSuccessResponse } = require('./util');

class IncomeStore {
    constructor(config, store, statManager) {
        this.m_config = config;
        this.m_store = store;
        this.m_statManager = statManager;
    }

    async queryIncomeLast24ByAddress(address) {
        if (!address) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        try {
            const url = `http://localhost:${this.m_config.localInterface.port}/stat/income/${address}`;
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

    async queryTotalIncomeByAddress(address) {
        if (!address) {
            return makeResponse(ERR_CODE.INVALID_PARAM, "Invalid param");
        }

        try {
            const result = await this.m_statManager.getTotalIncomeByAddress(address);

            if (result) {
                return makeSuccessResponse(result);
            }

        } catch (error) {
            logger.error('_getUtxoByInscriptionId failed:', error);
        }

        return makeResponse(ERR_CODE.UNKNOWN_ERROR);
    }
};

module.exports = {
    IncomeStore
};