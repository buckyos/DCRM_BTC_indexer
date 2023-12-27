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

    // async _getMintRecordByHash(ctx) {
    //     let txHash = ctx.params.tx_hash;

    //     if (!txHash) {
    //         return {
    //             err: 1,
    //             msg: "invalid param"
    //         };
    //     }

    //     let ret = this.m_store.queryMintRecordByHash(txHash);
    //     return {
    //         err: ret == null ? 1 : 0,
    //         data: ret
    //     };
    // }

    async _getMintRecordByAddress(ctx) {
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

        const result = this.m_store.queryMintRecordByAddress(
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

    async _getLuckyMintRecord(ctx) {
        const offset = ctx.params.offset;
        const length = ctx.params.length;
        const order = ctx.params.order;

        const result = this.m_store.queryLuckyMintRecord(
            length == 0 || length == null ? Number.MAX_SAFE_INTEGER : length,
            offset || 0,
            order ? order.toUpperCase() : "DESC"
        );
        return {
            err: 0,
            result
        }
    }

    async _getTotalMintLast24(ctx) {
        const beginTime = Date.now() - 24 * 60 * 60 * 1000;
        const endTime = Date.now() + 1;

        const total = this.m_store.queryTotalMintByTime(beginTime, endTime);
        return {
            err: 0,
            result: total,
        }
    }

    registerRouter(router) {
        this._init();

        // router.get("/mint_record_by_tx/:tx_hash", async (ctx) => {
        //     ctx.response.body = await this._getMintRecordByHash(ctx);
        // });

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
            ctx.response.body = await this._getTotalMintLast24(ctx);
        });

        return 0;
    }
}

module.exports = {
    MintService
}; 