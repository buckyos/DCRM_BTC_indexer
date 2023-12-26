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
        let hash = ctx.params.hash;
        if (!hash) {
            return {
                code: 1,
                msg: "invalid param"
            };
        }

        let ret = this.m_store.queryInscriptionByHash(hash);
        return {
            code: ret == null ? 1 : 0,
            data: ret
        };
    }

    async _getInscriptionByAddress(ctx) {
        let address = ctx.params.address;
        let offset = ctx.params.offset;
        let length = ctx.params.length;
        let order = ctx.params.order;

        if (!address) {
            return {
                code: 1,
                msg: "invalid param"
            };
        }

        let { count, list } = this.m_store.queryInscriptionByAddress(
            address,
            length == 0 || length == null ? Number.MAX_SAFE_INTEGER : length,
            offset || 0,
            order ? order.toUpperCase() : "DESC"
        );
        return {
            code: 0,
            count: count,
            list: list,
        }
    }

    async _getInscriptionByBlock(ctx) {
        let beginBlock = ctx.params.begin_block;
        let endBlock = ctx.params.end_block;
        let offset = ctx.params.offset;
        let length = ctx.params.length;
        let order = ctx.params.order;

        if (!beginBlock) {
            return {
                code: 1,
                msg: "invalid param"
            };
        }

        let { count, list } = this.m_store.queryInscriptionByBlock(
            beginBlock,
            endBlock == 0 || endBlock == null ? Number.MAX_SAFE_INTEGER : endBlock,
            length == 0 || length == null ? Number.MAX_SAFE_INTEGER : length,
            offset || 0,
            order ? order.toUpperCase() : "DESC"
        );
        return {
            code: 0,
            count: count,
            list: list,
        }
    }

    async _getResonanceByHash(ctx) {
        let hash = ctx.params.hash;
        let offset = ctx.params.offset;
        let length = ctx.params.length;
        let order = ctx.params.order;

        if (!hash) {
            return {
                code: 1,
                msg: "invalid param"
            };
        }

        let { count, list } = this.m_store.queryResonanceByHash(
            hash,
            length == 0 || length == null ? Number.MAX_SAFE_INTEGER : length,
            offset || 0,
            order ? order.toUpperCase() : "DESC"
        );
        return {
            code: 0,
            count: count,
            list: list,
        }
    }

    async _getResonanceByAddress(ctx) {
        let address = ctx.params.address;
        let offset = ctx.params.offset;
        let length = ctx.params.length;
        let order = ctx.params.order;

        if (!address) {
            return {
                code: 1,
                msg: "invalid param"
            };
        }

        let { count, list } = this.m_store.queryResonanceByAddress(
            address,
            length == 0 || length == null ? Number.MAX_SAFE_INTEGER : length,
            offset || 0,
            order ? order.toUpperCase() : "DESC"
        );
        return {
            code: 0,
            count: count,
            list: list,
        }
    }

    async _getChantByHash(ctx) {
        let hash = ctx.params.hash;
        let offset = ctx.params.offset;
        let length = ctx.params.length;
        let order = ctx.params.order;

        if (!hash) {
            return {
                code: 1,
                msg: "invalid param"
            };
        }

        let { count, list } = this.m_store.queryChantByHash(
            hash,
            length == 0 || length == null ? Number.MAX_SAFE_INTEGER : length,
            offset || 0,
            order ? order.toUpperCase() : "DESC"
        );
        return {
            code: 0,
            count: count,
            list: list,
        }
    }

    async _getChantByAddress(ctx) {
        let address = ctx.params.address;
        let offset = ctx.params.offset;
        let length = ctx.params.length;
        let order = ctx.params.order;

        if (!address) {
            return {
                code: 1,
                msg: "invalid param"
            };
        }

        let { count, list } = this.m_store.queryChantByAddress(
            address,
            length == 0 || length == null ? Number.MAX_SAFE_INTEGER : length,
            offset || 0,
            order ? order.toUpperCase() : "DESC"
        );
        return {
            code: 0,
            count: count,
            list: list,
        }
    }

    registerRouter(router) {
        this._init();

        router.get("/inscription/:hash", async (ctx) => {
            ctx.response.body = await this._getInscriptionByHash(ctx);
        });

        //order - asc or desc
        router.get("/inscription_by_address/:address/:length?/:offset?/:order?", async (ctx) => {
            ctx.response.body = await this._getInscriptionByAddress(ctx);
        });

        router.get("/inscription_by_block/:begin_block/:end_block?/:length?/:offset?/:order?", async (ctx) => {
            ctx.response.body = await this._getInscriptionByBlock(ctx);
        });

        router.get("/resonance_by_hash/:hash/:length?/:offset?/:order?", async (ctx) => {
            ctx.response.body = await this._getResonanceByHash(ctx);
        });

        router.get("/resonance_by_address/:address/:length?/:offset?/:order?", async (ctx) => {
            ctx.response.body = await this._getResonanceByAddress(ctx);
        });

        router.get("/chant_by_hash/:hash/:length?/:offset?/:order?", async (ctx) => {
            ctx.response.body = await this._getChantByHash(ctx);
        });

        router.get("/chant_by_address/:address/:length?/:offset?/:order?", async (ctx) => {
            ctx.response.body = await this._getChantByAddress(ctx);
        });

        return 0;
    }
}

module.exports = {
    InscribeService
}; 