const { ERR_CODE, makeResponse, makeSuccessResponse } = require('./util');
const { RankStore } = require('./rankStore');

class RankService {
    constructor() {
        this.m_inited = false;
        this.m_store = null;
    }

    _init() {
        if (this.m_inited) {
            return;
        }
        this.m_store = new RankStore();
        this.m_inited = true;
    }

    async _getResonantRank(ctx) {
        const { limit, offset } = ctx.params;

        return await this.m_store.queryResonantRank(
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0)
        );
    }

    registerRouter(router) {
        this._init();

        router.get("/resonant_rank/:limit?/:offset?", async (ctx) => {
            ctx.response.body = await this._getResonantRank(ctx);
        });

        return 0;
    }
}

module.exports = {
    RankService
};