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
        const limit = ctx.params.limit;
        const order = ctx.params.order;

        return this.m_store.queryMintRecordByAddress(
            address,
            //limit == 0 || limit == null ? Number.MAX_SAFE_INTEGER : limit,
            limit || 0,
            offset || 0,
            order ? order.toUpperCase() : "DESC"
        );
    }

    async _getLuckyMintRecord(ctx) {
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const order = ctx.params.order;

        return this.m_store.queryLuckyMintRecord(
            //length == 0 || length == null ? Number.MAX_SAFE_INTEGER : length,
            limit || 0,
            offset || 0,
            order ? order.toUpperCase() : "DESC"
        );
    }

    async _getTotalMintLast24(ctx) {
        const beginTime = Date.now() - 24 * 60 * 60 * 1000;
        const endTime = Date.now() + 1;

        return this.m_store.queryTotalMintByTime(beginTime, endTime);
    }

    async _getTotalMintByTime(ctx) {
        const beginTime = ctx.params.begin_time;
        const endTime = ctx.params.end_time;

        return this.m_store.queryTotalMintByTime(
            beginTime,
            endTime == 0 || endTime == null ? Number.MAX_SAFE_INTEGER : endTime
        );
    }

    async _getBalanceByAddress(ctx) {
        const address = ctx.params.address;

        return this.m_store.queryBalanceByAddress(address);
    }

    async _getIndexerState(ctx) {
        return this.m_store.queryIndexerState();
    }

    async _getIncome(ctx) {
        const address = ctx.params.address;
        const beginTime = ctx.params.begin_time;
        const endTime = ctx.params.end_time;

        return this.m_store.queryIncomeByTime(
            address,
            beginTime,
            endTime == 0 || endTime == null ? Number.MAX_SAFE_INTEGER : endTime
        );
    }

    async _getMingProgress(ctx) {
        return this.m_store.queryMintProgress();
    }

    registerRouter(router) {
        this._init();

        // router.get("/mint_record_by_tx/:tx_hash", async (ctx) => {
        //     ctx.response.body = await this._getMintRecordByHash(ctx);
        // });

        router.get("/mint_record_by_address/:address/:limit?/:offset?/:order?", async (ctx) => {
            ctx.response.body = await this._getMintRecordByAddress(ctx);
        });

        router.get("/luck_mint/:limit?/:offset?/:order?", async (ctx) => {
            ctx.response.body = await this._getLuckyMintRecord(ctx);
        });

        router.get("/mint_progress", async (ctx) => {
            ctx.response.body = await this._getMingProgress(ctx);
        });

        router.get("/mint_remain", async (ctx) => {
            ctx.response.body = "not implemented";
        });

        router.get("/mint_last_24", async (ctx) => {
            ctx.response.body = await this._getTotalMintLast24(ctx);
        });

        router.get("/total_mint/:begin_time/:end_time?", async (ctx) => {
            ctx.response.body = await this._getTotalMintByTime(ctx);
        });

        router.get("/balance/:address", async (ctx) => {
            ctx.response.body = await this._getBalanceByAddress(ctx);
        });

        router.get("/indexer/state", async (ctx) => {
            ctx.response.body = await this._getIndexerState(ctx);
        });

        router.get("/income/:address/:begin_time/:end_time?", async (ctx) => {
            ctx.response.body = await this._getIncome(ctx);
        });

        return 0;
    }
}

module.exports = {
    MintService
}; 