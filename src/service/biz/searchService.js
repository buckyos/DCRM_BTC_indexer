const { SearchStore } = require('./searchStore.js');

class SearchService {
    constructor() {
        this.m_inited = false;
        this.m_store = null;
    }

    _init() {
        if (this.m_inited) {
            return;
        }
        this.m_store = new SearchStore();
        this.m_inited = true;
    }

    async _getSearchResult(ctx) {
        const str = ctx.params.str;

        return this.m_store.queryByTxid(str);
    }

    registerRouter(router) {
        this._init();

        router.get("/search/:str", async (ctx) => {
            ctx.response.body = await this._getSearchResult(ctx);
        });


        return 0;
    }
}

module.exports = {
    SearchService
}; 