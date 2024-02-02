const { SearchStore } = require('./searchStore.js');

class SearchService {
    constructor(config, store) {
        this.m_store = new SearchStore(store);
    }

    _init() {
    }

    async _search(ctx) {
        const str = ctx.params.str;

        return this.m_store.search(str);
    }

    async _searchByInscriptionNumber(ctx) {
        const str = ctx.params.number;

        return this.m_store.searchByInscriptionNumber(str);
    }

    async _searchByInscriptionId(ctx) {
        const id = ctx.params.id;

        return this.m_store.searchByInscriptionId(id);
    }

    async _searchByInscriptionHash(ctx) {
        const hash = ctx.params.hash;

        return this.m_store.searchByInscriptionHash(hash);
    }

    registerRouter(router) {
        this._init();

        router.get("/search/:str", async (ctx) => {
            ctx.response.body = await this._search(ctx);
        });

        router.get("/inscription_number/:number", async (ctx) => {
            ctx.response.body = await this._searchByInscriptionNumber(ctx);
        });

        router.get("/inscription_id/:id", async (ctx) => {
            ctx.response.body = await this._searchByInscriptionId(ctx);
        });

        router.get("/inscription_hash/:hash", async (ctx) => {
            ctx.response.body = await this._searchByInscriptionHash(ctx);
        });


        return 0;
    }
}

module.exports = {
    SearchService
}; 