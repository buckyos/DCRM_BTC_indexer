const { SearchStore } = require('./searchStore.js');

class SearchService {
    constructor(config, store) {
        this.m_store = new SearchStore(store);
    }

    _init() {
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