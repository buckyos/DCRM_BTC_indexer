const { OpsStore } = require('./opsStore');

class OpsService {
    constructor(config, store) {
        this.m_config = config;
        this.m_store = new OpsStore(config, store);
    }

    async _getOpsByAddress(ctx) {
        const address = ctx.params.address;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const state = ctx.params.state;
        const order = ctx.params.order;

        return this.m_store.queryOpsByAddress(
            address,
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            state && _.isString(state) ? state.toLowerCase() : "all",
            order && _.isString(order) ? order.toLowerCase() : "desc"
        );
    }

    async _getOpsByInscription(ctx) {
        const inscription = ctx.params.inscription_id;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const state = ctx.params.state;
        const order = ctx.params.order;

        return this.m_store.queryOpsByInscription(
            inscription,
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            state && _.isString(state) ? state.toLowerCase() : "all",
            order && _.isString(order) ? order.toLowerCase() : "desc"
        );
    }

    async _getOpsByInscriptionAndAddress(ctx) {
        const inscription = ctx.params.inscription_id;
        const address = ctx.params.address;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const state = ctx.params.state;
        const order = ctx.params.order;

        return this.m_store.queryOpsByInscriptionAndAddress(
            inscription,
            address,
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            state && _.isString(state) ? state.toLowerCase() : "all",
            order && _.isString(order) ? order.toLowerCase() : "desc"
        );
    }

    async _getDataOpByHash(ctx) {
        const hash = ctx.params.hash;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const state = ctx.params.state;
        const order = ctx.params.order;

        return this.m_store.queryDataOpByHash(
            hash,
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            state && _.isString(state) ? state.toLowerCase() : "all",
            order && _.isString(order) ? order.toLowerCase() : "desc"
        );
    }

    async _getOpsByTx(ctx) {
        const txid = ctx.params.txid;

        return this.m_store.queryOpsByTx(
            txid
        );
    }

    registerRouter(router) {
        router.get("/ops_by_address/:address/:limit?/:offset?/:state?/:order?", async (ctx) => {
            ctx.response.body = await this._getOpsByAddress(ctx);
        });

        router.get("/ops_by_inscription/:inscription_id/:limit?/:offset?/:state?/:order?", async (ctx) => {
            ctx.response.body = await this._getOpsByInscription(ctx);
        });

        router.get("/ops_by_inscription_address/:inscription_id/:address/:limit?/:offset?/:state?/:order?", async (ctx) => {
            ctx.response.body = await this._getOpsByInscriptionAndAddress(ctx);
        });

        router.get("/ops_by_tx/:txid", async (ctx) => {
            ctx.response.body = await this._getOpsByTx(ctx);
        });

        router.get("/data_ops/:hash/:limit?/:offset?/:state?/:order?", async (ctx) => {
            ctx.response.body = await this._getDataOpByHash(ctx);
        });
    }
};

module.exports = {
    OpsService
};