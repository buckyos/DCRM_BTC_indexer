const { MintStore } = require('./mintStore');

class MintService {
    constructor() {
        this.m_inited = false;
        this.m_store = null;
    }

    _init() {
        if (this.m_inited) {
            return;
        }
        this.m_store = new MintStore();
        this.m_inited = true;
    }

    async _getMintRecordByHash(ctx) {
        let txHash = ctx.params.tx_hash;

        if (!txHash) {
            return {
                code: 1,
                msg: "invalid param"
            };
        }

        let ret = this.m_store.queryMintRecordByHash(txHash);
        return {
            code: ret == null ? 1 : 0,
            data: ret
        };
    }

    async _getMintRecordByAddress(ctx) {
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

        let { count, list } = this.m_store.queryMintRecordByAddress(
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

    async _getLuckyMintRecord(ctx) {
        let offset = ctx.params.offset;
        let length = ctx.params.length;
        let order = ctx.params.order;

        let { count, list } = this.m_store.queryLuckyMintRecord(
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

        router.get("/mint_record_by_tx/:tx_hash", async (ctx) => {
            ctx.response.body = await this._getMintRecordByHash(ctx);
        });

        router.get("/mint_record_by_address/:address/:length?/:offset?/:order?", async (ctx) => {
            ctx.response.body = await this._getMintRecordByAddress(ctx);
        });

        router.get("/luck_mint/:length?/:offset?/:order?", async (ctx) => {
            ctx.response.body = await this._getLuckyMintRecord(ctx);
        });

        router.get("/mint_remain", async (ctx) => {
            ctx.response.body = "not implemented";
        });

        router.get("/mint_last_24", async (ctx) => {
            ctx.response.body = "not implemented";
        });

        return 0;
    }
}

module.exports = {
    MintService
}; 