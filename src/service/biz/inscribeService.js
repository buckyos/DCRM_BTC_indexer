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
        if (!hash) {
            return {
                err: 1,
                msg: "invalid param"
            };
        }

        const ret = this.m_store.queryInscriptionByHash(hash);
        return {
            err: ret == null ? 1 : 0,
            result: ret
        };
    }

    async _getInscriptionByAddress(ctx) {
        const address = ctx.params.address;
        const offset = ctx.params.offset;
        const length = ctx.params.length;
        const order = ctx.params.order;

        if (!address) {
            return {
                err: 1,
                msg: "invalid param"
            };
        }

        const result = this.m_store.queryInscriptionByAddress(
            address,
            length == 0 || length == null ? Number.MAX_SAFE_INTEGER : length,
            offset || 0,
            order ? order.toUpperCase() : "DESC"
        );
        return {
            err: 0,
            result
        }
    }

    async _getInscriptionByBlock(ctx) {
        const beginBlock = ctx.params.begin_block;
        const endBlock = ctx.params.end_block;
        const offset = ctx.params.offset;
        const length = ctx.params.length;
        const order = ctx.params.order;

        if (!beginBlock) {
            return {
                err: 1,
                msg: "invalid param"
            };
        }

        const result = this.m_store.queryInscriptionByBlock(
            beginBlock,
            endBlock == 0 || endBlock == null ? Number.MAX_SAFE_INTEGER : endBlock,
            length == 0 || length == null ? Number.MAX_SAFE_INTEGER : length,
            offset || 0,
            order ? order.toUpperCase() : "DESC"
        );
        return {
            err: 0,
            result
        }
    }

    async _getResonanceByHash(ctx) {
        const hash = ctx.params.hash;
        const offset = ctx.params.offset;
        const length = ctx.params.length;
        const order = ctx.params.order;

        if (!hash) {
            return {
                err: 1,
                msg: "invalid param"
            };
        }

        const result = this.m_store.queryResonanceByHash(
            hash,
            length == 0 || length == null ? Number.MAX_SAFE_INTEGER : length,
            offset || 0,
            order ? order.toUpperCase() : "DESC"
        );
        return {
            err: 0,
            result
        }
    }

    async _getResonanceByAddress(ctx) {
        const address = ctx.params.address;
        const offset = ctx.params.offset;
        const length = ctx.params.length;
        const order = ctx.params.order;

        if (!address) {
            return {
                err: 1,
                msg: "invalid param"
            };
        }

        const result = this.m_store.queryResonanceByAddress(
            address,
            length == 0 || length == null ? Number.MAX_SAFE_INTEGER : length,
            offset || 0,
            order ? order.toUpperCase() : "DESC"
        );
        return {
            err: 0,
            result
        }
    }

    async _getChantByHash(ctx) {
        const hash = ctx.params.hash;
        const offset = ctx.params.offset;
        const length = ctx.params.length;
        const order = ctx.params.order;

        if (!hash) {
            return {
                err: 1,
                msg: "invalid param"
            };
        }

        const result = this.m_store.queryChantByHash(
            hash,
            length == 0 || length == null ? Number.MAX_SAFE_INTEGER : length,
            offset || 0,
            order ? order.toUpperCase() : "DESC"
        );
        return {
            err: 0,
            result
        }
    }

    async _getChantByAddress(ctx) {
        const address = ctx.params.address;
        const offset = ctx.params.offset;
        const length = ctx.params.length;
        const order = ctx.params.order;

        if (!address) {
            return {
                err: 1,
                msg: "invalid param"
            };
        }

        const result = this.m_store.queryChantByAddress(
            address,
            length == 0 || length == null ? Number.MAX_SAFE_INTEGER : length,
            offset || 0,
            order ? order.toUpperCase() : "DESC"
        );
        return {
            err: 0,
            result
        }
    }

    async _getInscriptionCount(ctx) {
        const count = this.m_store.queryInscriptionCount();
        return {
            err: count == null ? 1 : 0,
            result: count,
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

        router.get("/inscription_count", async (ctx) => {
            ctx.response.body = await this._getInscriptionCount(ctx);
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