const { InscribeStore } = require('./inscribeStore.js');

class InscribeService {
    constructor() {
        this.m_inited = false;
        this.m_store = null;
    }

    _init() {
        if (this.m_inited) {
            return;
        }
        this.m_store = new InscribeStore();
        this.m_inited = true;
    }

    async _getInscriptionByHash(ctx) {
        const hash = ctx.params.hash;

        return this.m_store.queryInscriptionByHash(hash);
    }

    async _getInscriptionByAddress(ctx) {
        const address = ctx.params.address;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const order = ctx.params.order;

        return this.m_store.queryInscriptionByAddress(
            address,
            //length == 0 || length == null ? Number.MAX_SAFE_INTEGER : length,
            limit || 0,
            offset || 0,
            order ? order.toUpperCase() : "DESC"
        );
    }

    async _getInscriptionByBlock(ctx) {
        const beginBlock = ctx.params.begin_block;
        const endBlock = ctx.params.end_block;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const order = ctx.params.order;

        return this.m_store.queryInscriptionByBlock(
            beginBlock,
            endBlock == 0 || endBlock == null ? Number.MAX_SAFE_INTEGER : endBlock,
            limit || 0,
            offset || 0,
            order ? order.toUpperCase() : "DESC"
        );
    }

    async _getInscribeByHash(ctx) {
        const hash = ctx.params.hash;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const order = ctx.params.order;
        const state = ctx.params.state;

        return this.m_store.queryInscribeByHash(
            hash,
            limit || 0,
            offset || 0,
            state ? state.toUpperCase() : "ALL",
            order ? order.toUpperCase() : "DESC",
        );
    }

    async _getInscribeByAddress(ctx) {
        const address = ctx.params.address;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const order = ctx.params.order;
        const state = ctx.params.state;

        return this.m_store.queryInscribeByAddress(
            address,
            limit || 0,
            offset || 0,
            state ? state.toUpperCase() : "ALL",
            order ? order.toUpperCase() : "DESC"
        );
    }

    async _getInscribeByTx(ctx) {
        const txid = ctx.params.txid;

        return this.m_store.queryInscribeByTx(
            txid
        );
    }

    async _getResonanceByHash(ctx) {
        const hash = ctx.params.hash;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const order = ctx.params.order;
        const state = ctx.params.state;

        return this.m_store.queryResonanceByHash(
            hash,
            //length == 0 || length == null ? Number.MAX_SAFE_INTEGER : length,
            limit || 0,
            offset || 0,
            state ? state.toUpperCase() : "ALL",
            order ? order.toUpperCase() : "DESC"
        );
    }

    async _getResonanceByAddress(ctx) {
        const address = ctx.params.address;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const order = ctx.params.order;
        const state = ctx.params.state;

        return this.m_store.queryResonanceByAddress(
            address,
            limit || 0,
            offset || 0,
            state ? state.toUpperCase() : "ALL",
            order ? order.toUpperCase() : "DESC"
        );
    }

    async _getResonanceByTx(ctx) {
        const txid = ctx.params.txid;

        return this.m_store.queryResonanceByTx(
            txid
        );
    }

    async _getChantByHash(ctx) {
        const hash = ctx.params.hash;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const order = ctx.params.order;
        const state = ctx.params.state;

        return this.m_store.queryChantByHash(
            hash,
            limit || 0,
            offset || 0,
            state ? state.toUpperCase() : "ALL",
            order ? order.toUpperCase() : "DESC"
        );
    }

    async _getChantByAddress(ctx) {
        const address = ctx.params.address;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const order = ctx.params.order;
        const state = ctx.params.state;

        return this.m_store.queryChantByAddress(
            address,
            limit || 0,
            offset || 0,
            state ? state.toUpperCase() : "ALL",
            order ? order.toUpperCase() : "DESC"
        );
    }

    async _getChantByTx(ctx) {
        const txid = ctx.params.txid;

        return this.m_store.queryChantByTx(
            txid
        );
    }

    async _getSetPriceByHash(ctx) {
        const hash = ctx.params.hash;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const order = ctx.params.order;
        const state = ctx.params.state;

        return this.m_store.querySetPriceByHash(
            hash,
            limit || 0,
            offset || 0,
            state ? state.toUpperCase() : "ALL",
            order ? order.toUpperCase() : "DESC"
        );
    }

    async _getSetPriceByAddress(ctx) {
        const address = ctx.params.address;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const order = ctx.params.order;
        const state = ctx.params.state;

        return this.m_store.querySetPriceByAddress(
            address,
            limit || 0,
            offset || 0,
            state ? state.toUpperCase() : "ALL",
            order ? order.toUpperCase() : "DESC"
        );
    }

    async _getSetPriceByTx(ctx) {
        const txid = ctx.params.txid;

        return this.m_store.querySetPriceByTx(
            txid
        );
    }

    async _getInscriptionCount(ctx) {
        return this.m_store.queryInscriptionCount();
    }

    registerRouter(router) {
        this._init();

        router.get("/inscription/:hash", async (ctx) => {
            ctx.response.body = await this._getInscriptionByHash(ctx);
        });

        //order - asc or desc
        router.get("/inscription_by_address/:address/:limit?/:offset?/:order?", async (ctx) => {
            ctx.response.body = await this._getInscriptionByAddress(ctx);
        });

        router.get("/inscription_by_block/:begin_block/:end_block?/:limit?/:offset?/:order?", async (ctx) => {
            ctx.response.body = await this._getInscriptionByBlock(ctx);
        });

        router.get("/inscription_count", async (ctx) => {
            ctx.response.body = await this._getInscriptionCount(ctx);
        });

        router.get("/inscribe_by_hash/:hash/:limit?/:offset?/:state?/:order?", async (ctx) => {
            ctx.response.body = await this._getInscribeByHash(ctx);
        });

        router.get("/inscribe_by_address/:address/:limit?/:offset?/:state?/:order?", async (ctx) => {
            ctx.response.body = await this._getInscribeByAddress(ctx);
        });

        router.get("/inscribe_by_tx/:txid", async (ctx) => {
            ctx.response.body = await this._getInscribeByTx(ctx);
        });

        router.get("/resonance_by_hash/:hash/:limit?/:offset?/:state?/:order?", async (ctx) => {
            ctx.response.body = await this._getResonanceByHash(ctx);
        });

        router.get("/resonance_by_address/:address/:limit?/:offset?/:state?/:order?", async (ctx) => {
            ctx.response.body = await this._getResonanceByAddress(ctx);
        });

        router.get("/resonance_by_tx/:txid", async (ctx) => {
            ctx.response.body = await this._getResonanceByTx(ctx);
        });

        router.get("/chant_by_hash/:hash/:limit?/:offset?/:state?/:order?", async (ctx) => {
            ctx.response.body = await this._getChantByHash(ctx);
        });

        router.get("/chant_by_address/:address/:limit?/:offset?/:state?/:order?", async (ctx) => {
            ctx.response.body = await this._getChantByAddress(ctx);
        });

        router.get("/chant_by_tx/:txid", async (ctx) => {
            ctx.response.body = await this._getChantByTx(ctx);
        });

        router.get("/set_price_by_hash/:hash/:limit?/:offset?/:state?/:order?", async (ctx) => {
            ctx.response.body = await this._getSetPriceByHash(ctx);
        });

        router.get("/set_price_by_address/:address/:limit?/:offset?/:state?/:order?", async (ctx) => {
            ctx.response.body = await this._getSetPriceByAddress(ctx);
        });

        router.get("/set_price_by_tx/:txid", async (ctx) => {
            ctx.response.body = await this._getSetPriceByTx(ctx);
        });

        return 0;
    }
}

module.exports = {
    InscribeService
}; 