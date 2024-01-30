const { IncomeStore } = require('./incomeStore');

class IncomeService {
    constructor(config, store, statManager) {
        this.m_config = config;
        this.m_store = new IncomeStore(config, store, statManager);
    }

    async _getIncomeLast24ByAddress(ctx) {
        const address = ctx.params.address;

        return await this.m_store.queryIncomeLast24ByAddress(address);
    }

    async _getTotalIncomeByAddress(ctx) {
        const address = ctx.params.address;

        return await this.m_store.queryTotalIncomeByAddress(address);
    }

    registerRouter(router) {
        router.get("/income_last_24/:address", async (ctx) => {
            ctx.response.body = await this._getIncomeLast24ByAddress(ctx);
        });

        router.get("/income/:address", async (ctx) => {
            ctx.response.body = await this._getTotalIncomeByAddress(ctx);
        });
    }
};

module.exports = {
    IncomeService
};