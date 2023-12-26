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

    async _getInscription(ctx) {
        let hash = ctx.query.hash;
        let address = ctx.query.address;
        let offset = ctx.query.offset;
        let length = ctx.query.length;

        logger.debug('_getInscription:', hash, address);
        if (hash) {
            //find by hash
            let ret = this.m_store.queryInscriptionByHash(hash);
            return {
                code: ret == null ? 1 : 0,
                data: ret
            };
        } else if (address && offset && length) {
            //find by owner
            let { count, list } = this.m_store.queryInscriptionByAddress(address, offset, length);
            return {
                code: 0,
                count: count,
                list: list,
            }
        } else {
            return {
                code: 1,
                msg: "invalid param"
            };
        }
    }

    async _getInscriptionByHash(hash) {

    }

    async _getResonanceList(ctx) {
        let hash = ctx.query.hash;
        let address = ctx.query.address;
        if (hash) {
            //find by hash
        } else if (address) {
            //find by address
        } else {
            return {
                code: 1,
                msg: "invalid param"
            };
        }
    }

    async _getChantList(ctx) {
        let hash = ctx.query.hash;
        let address = ctx.query.address;
        if (hash) {
            //find by hash
        } else if (address) {
            //find by address
        } else {
            return {
                code: 1,
                msg: "invalid param"
            };
        }
    }

    registerRouter(router) {
        this._init();

        router.get("/inscription", async (ctx) => {
            ctx.response.body = await this._getInscription(ctx);
        });

        router.get("/resonance_list", async (ctx) => {
            ctx.response.body = await this._getResonanceList(ctx);
        });

        router.get("/chant_list", async (ctx) => {
            ctx.response.body = await this._getChantList(ctx);
        });

        return 0;
    }
}

module.exports = {
    InscribeService
}; 