const { InscribeStore } = require('./inscribeStore.js');

class InscribeService {
    constructor(config, store) {
        this.m_store = new InscribeStore(config, store);
        this.m_config = config;
    }

    _init() {
    }

    async _getInscriptionDataByHash(ctx) {
        const hash = ctx.params.hash;

        return this.m_store.queryInscriptionDataByHash(hash);
    }

    async _getInscriptionDataById(ctx) {
        const inscriptionId = ctx.params.inscription_id;

        return this.m_store.queryInscriptionDataById(inscriptionId);
    }

    async _getInscriptionById(ctx) {
        const inscriptionId = ctx.params.inscription_id;

        return this.m_store.queryInscriptionById(inscriptionId);
    }

    async _getInscriptionDataByAddress(ctx) {
        const address = ctx.params.address;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const order = ctx.params.order;

        return this.m_store.queryInscriptionDataByAddress(
            address,
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            order && _.isString(order) ? order.toLowerCase() : "desc"
        );
    }

    async _getInscriptionByOwner(ctx) {
        const owner = ctx.params.address;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const order = ctx.params.order;

        return this.m_store.queryInscriptionByOwner(
            owner,
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            order && _.isString(order) ? order.toLowerCase() : "desc"
        );
    }

    async _getInscriptionByCreator(ctx) {
        const creator = ctx.params.address;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const order = ctx.params.order;

        return this.m_store.queryInscriptionByCreator(
            creator,
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            order && _.isString(order) ? order.toLowerCase() : "desc"
        );
    }

    async _getInscriptionDataByBlock(ctx) {
        const beginBlock = ctx.params.begin_block;
        const endBlock = ctx.params.end_block;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const order = ctx.params.order;

        return this.m_store.queryInscriptionDataByBlock(
            beginBlock,
            endBlock == 0 || endBlock == null ? Number.MAX_SAFE_INTEGER : endBlock,
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            order && _.isString(order) ? order.toLowerCase() : "desc"
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
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            state && _.isString(state) ? state.toLowerCase() : "all",
            order && _.isString(order) ? order.toLowerCase() : "desc",
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
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            state && _.isString(state) ? state.toLowerCase() : "all",
            order && _.isString(order) ? order.toLowerCase() : "desc"
        );
    }

    async _getInscribeByHashAndAddress(ctx) {
        const hash = ctx.params.hash;
        const address = ctx.params.address;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const order = ctx.params.order;
        const state = ctx.params.state;

        return this.m_store.queryInscribeByHashAndAddress(
            hash,
            address,
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            state && _.isString(state) ? state.toLowerCase() : "all",
            order && _.isString(order) ? order.toLowerCase() : "desc"
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
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            state && _.isString(state) ? state.toLowerCase() : "all",
            order && _.isString(order) ? order.toLowerCase() : "desc"
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
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            state && _.isString(state) ? state.toLowerCase() : "all",
            order && _.isString(order) ? order.toLowerCase() : "desc"
        );
    }

    async _getResonanceByHashAndAddress(ctx) {
        const hash = ctx.params.hash;
        const address = ctx.params.address;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const order = ctx.params.order;
        const state = ctx.params.state;

        return this.m_store.queryResonanceByHashAndAddress(
            hash,
            address,
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            state && _.isString(state) ? state.toLowerCase() : "all",
            order && _.isString(order) ? order.toLowerCase() : "desc"
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
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            state && _.isString(state) ? state.toLowerCase() : "all",
            order && _.isString(order) ? order.toLowerCase() : "desc"
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
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            state && _.isString(state) ? state.toLowerCase() : "all",
            order && _.isString(order) ? order.toLowerCase() : "desc"
        );
    }

    async _getChantByHashAndAddress(ctx) {
        const hash = ctx.params.hash;
        const address = ctx.params.address;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const order = ctx.params.order;
        const state = ctx.params.state;

        return this.m_store.queryChantByHashAndAddress(
            hash,
            address,
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            state && _.isString(state) ? state.toLowerCase() : "all",
            order && _.isString(order) ? order.toLowerCase() : "desc"
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
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            state && _.isString(state) ? state.toLowerCase() : "all",
            order && _.isString(order) ? order.toLowerCase() : "desc"
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
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            state && _.isString(state) ? state.toLowerCase() : "all",
            order && _.isString(order) ? order.toLowerCase() : "desc"
        );
    }

    async _getSetPriceByTx(ctx) {
        const txid = ctx.params.txid;

        return this.m_store.querySetPriceByTx(
            txid
        );
    }

    async _getInscriptionDataCount(ctx) {
        return this.m_store.queryInscriptionDataCount();
    }

    async _getTransferByAddress(ctx) {
        const address = ctx.params.address;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const state = ctx.params.state;
        const order = ctx.params.order;
        const stage = ctx.params.stage;

        return this.m_store.queryTransferByAddress(
            address,
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            state && _.isString(state) ? state.toLowerCase() : "all",
            order && _.isString(order) ? order.toLowerCase() : "desc",
            stage && _.isString(stage) ? stage.toLowerCase() : "all"
        );
    }

    async _getTransferByFromAddress(ctx) {
        const address = ctx.params.address;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const state = ctx.params.state;
        const order = ctx.params.order;
        const stage = ctx.params.stage;

        return this.m_store.queryTransferByFromAddress(
            address,
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            state && _.isString(state) ? state.toLowerCase() : "all",
            order && _.isString(order) ? order.toLowerCase() : "desc",
            stage && _.isString(stage) ? stage.toLowerCase() : "all"
        );
    }

    async _getTransferByTx(ctx) {
        const txid = ctx.params.txid;

        return this.m_store.queryTransferByTx(
            txid
        );
    }

    async _getInscribeDataTransferByHash(ctx) {
        const hash = ctx.params.hash;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const state = ctx.params.state;
        const order = ctx.params.order;

        return this.m_store.queryInscribeDataTransferByHash(
            hash,
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            state && _.isString(state) ? state.toLowerCase() : "all",
            order && _.isString(order) ? order.toLowerCase() : "desc"
        );
    }

    async _getInscribeDataTransferByAddress(ctx) {
        const address = ctx.params.address;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const state = ctx.params.state;
        const order = ctx.params.order;

        return this.m_store.queryInscribeDataTransferByAddress(
            address,
            Math.max((parseInt(limit, 10) || 0), 0),
            Math.max((parseInt(offset, 10) || 0), 0),
            state && _.isString(state) ? state.toLowerCase() : "all",
            order && _.isString(order) ? order.toLowerCase() : "desc"
        );
    }

    async _getInscribeDataTransferByTx(ctx) {
        const txid = ctx.params.txid;

        return this.m_store.queryInscribeDataTransferByTx(
            txid
        );
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

    async _getOpsByTx(ctx) {
        const txid = ctx.params.txid;

        return this.m_store.queryOpsByTx(
            txid
        );
    }

    async _getRelationByAddress(ctx) {
        const address = ctx.params.address;

        return this.m_store.queryRelationByAddress(
            address
        );
    }

    async _getRelationByHash(ctx) {
        const hash = ctx.params.hash;

        return this.m_store.queryRelationByHash(
            hash
        );
    }

    async _getVerifyRelationByAddress(ctx) {
        const address = ctx.params.address;

        return this.m_store.queryVerifyRelationByAddress(
            address
        );
    }

    async _getVerifyRelationByHash(ctx) {
        const hash = ctx.params.hash;

        return this.m_store.queryVerifyRelationByHash(
            hash
        );
    }

    async _getInscriptionOpById(ctx) {
        const inscriptionId = ctx.params.inscription_id;

        return this.m_store.queryInscriptionOpById(
            inscriptionId
        );
    }

    async _getDataOpByHash(ctx) {
        const hash = ctx.params.hash;

        return this.m_store.queryDataOpByHash(
            hash
        );
    }

    registerRouter(router) {
        this._init();

        // all inscription
        router.get("/inscription_id/:inscription_id", async (ctx) => {
            ctx.response.body = await this._getInscriptionById(ctx);
        });

        router.get("/inscription_by_owner/:address/:limit?/:offset?/:order?", async (ctx) => {
            ctx.response.body = await this._getInscriptionByOwner(ctx);
        });

        router.get("/inscription_by_creator/:address/:limit?/:offset?/:order?", async (ctx) => {
            ctx.response.body = await this._getInscriptionByCreator(ctx);
        });

        // only inscription data
        router.get("/inscription_data/:hash", async (ctx) => {
            ctx.response.body = await this._getInscriptionDataByHash(ctx);
        });

        router.get("/inscription_data_id/:inscription_id", async (ctx) => {
            ctx.response.body = await this._getInscriptionDataById(ctx);
        });

        //order - asc or desc
        router.get("/inscription_data_by_address/:address/:limit?/:offset?/:order?", async (ctx) => {
            ctx.response.body = await this._getInscriptionDataByAddress(ctx);
        });

        router.get("/inscription_data_by_block/:begin_block/:end_block?/:limit?/:offset?/:order?", async (ctx) => {
            ctx.response.body = await this._getInscriptionDataByBlock(ctx);
        });

        router.get("/inscription_data_count", async (ctx) => {
            ctx.response.body = await this._getInscriptionDataCount(ctx);
        });

        router.get("/inscribe_by_hash/:hash/:limit?/:offset?/:state?/:order?", async (ctx) => {
            ctx.response.body = await this._getInscribeByHash(ctx);
        });

        router.get("/inscribe_by_address/:address/:limit?/:offset?/:state?/:order?", async (ctx) => {
            ctx.response.body = await this._getInscribeByAddress(ctx);
        });

        router.get("/inscribe_by_hash_address/:hash/:address/:limit?/:offset?/:state?/:order?", async (ctx) => {
            ctx.response.body = await this._getInscribeByHashAndAddress(ctx);
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

        router.get("/resonance_by_hash_address/:hash/:address/:limit?/:offset?/:state?/:order?", async (ctx) => {
            ctx.response.body = await this._getResonanceByHashAndAddress(ctx);
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

        router.get("/chant_by_hash_address/:hash/:address/:limit?/:offset?/:state?/:order?", async (ctx) => {
            ctx.response.body = await this._getChantByHashAndAddress(ctx);
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

        router.get("/transfer_by_address/:address/:limit?/:offset?/:state?/:order?/:stage?", async (ctx) => {
            ctx.response.body = await this._getTransferByAddress(ctx);
        });

        router.get("/transfer_from/:address/:limit?/:offset?/:state?/:order?/:stage?", async (ctx) => {
            ctx.response.body = await this._getTransferByFromAddress(ctx);
        });

        router.get("/transfer_by_tx/:txid", async (ctx) => {
            ctx.response.body = await this._getTransferByTx(ctx);
        });

        router.get("/inscribe_data_transfer_by_hash/:hash/:limit?/:offset?/:state?/:order?", async (ctx) => {
            ctx.response.body = await this._getInscribeDataTransferByHash(ctx);
        });

        router.get("/inscribe_data_transfer_by_address/:address/:limit?/:offset?/:state?/:order?", async (ctx) => {
            ctx.response.body = await this._getInscribeDataTransferByAddress(ctx);
        });

        router.get("/inscribe_data_transfer_by_tx/:txid", async (ctx) => {
            ctx.response.body = await this._getInscribeDataTransferByTx(ctx);
        });

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

        router.get("/res_relation_by_address/:address", async (ctx) => {
            ctx.response.body = await this._getRelationByAddress(ctx);
        });

        router.get("/res_relation_by_hash/:hash", async (ctx) => {
            ctx.response.body = await this._getRelationByHash(ctx);
        });

        router.get("/res_relation_by_address/verify/:address", async (ctx) => {
            ctx.response.body = await this._getVerifyRelationByAddress(ctx);
        });

        router.get("/res_relation_by_hash/verify/:hash", async (ctx) => {
            ctx.response.body = await this._getVerifyRelationByAddress(ctx);
        });

        router.get("/inscription_op/:inscription_id", async (ctx) => {
            ctx.response.body = await this._getInscriptionOpById(ctx);
        });

        router.get("/data_ops/:hash", async (ctx) => {
            ctx.response.body = await this._getDataOpByHash(ctx);
        });

        return 0;
    }
}

module.exports = {
    InscribeService
}; 