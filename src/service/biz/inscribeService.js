class InscribeService {
    constructor() {
        this.m_inited = false;
    }

    _init() {
        if (this.m_inited) {
            return;
        }

        this.m_inited = true;
    }

    async _getInscription(ctx) {
        let hash = ctx.query.hash;
        let address = ctx.query.address;
        if (hash) {
            //find by hash
        } else if (address) {
            //find by owner
        } else {
            return {
                code: 1,
                msg: "invalid param"
            };
        }
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
    InscribeService,
}