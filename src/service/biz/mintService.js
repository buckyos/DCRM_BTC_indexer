const { MintStore } = require('./mintStore');

class MintService {
    constructor(config) {
        this.m_inited = false;
        this.m_store = null;
        this.m_config = config;
    }

    _init() {
        if (this.m_inited) {
            return;
        }
        this.m_store = new MintStore(this.m_config);
        this.m_inited = true;
    }

    async _getMintRecordByAddress(ctx) {
        const address = ctx.params.address;
        const offset = ctx.params.offset;
        const limit = ctx.params.limit;
        const order = ctx.params.order;
        const state = ctx.params.state;

        return this.m_store.queryMintRecordByAddress(
            address,
            //limit == 0 || limit == null ? Number.MAX_SAFE_INTEGER : limit,
            limit || 0,
            offset || 0,
            state ? state.toLowerCase() : "all",
            order && _.isString(order) ? order.toLowerCase() : "desc"
        );
    }

    async _getMintRecordByTx(ctx) {
        const txid = ctx.params.txid;

        return this.m_store.queryMintRecordByTx(
            txid
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
            order && _.isString(order) ? order.toLowerCase() : "desc"
        );
    }

    async _getTotalMintLast24(ctx) {
        const endTime = Math.floor(Date.now() / 1000);
        const beginTime = endTime - 24 * 3600;

        return this.m_store.queryTotalMintByTime(beginTime, endTime + 1);
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

    async _getHashWeight(ctx) {
        const hash = ctx.params.hash;

        return await this.m_store.queryHashWeight(hash);
    }

    async _getIndexerStateDetail(ctx) {
        return await this.m_store.queryIndexerStateDetail();
    }

    async _getMingProgress(ctx) {
        return this.m_store.queryMintProgress();
    }

    registerRouter(router) {
        this._init();

        router.get("/mint_record_by_address/:address/:limit?/:offset?/:state?/:order?", async (ctx) => {
            ctx.response.body = await this._getMintRecordByAddress(ctx);
        });

        router.get("/mint_record_by_tx/:txid", async (ctx) => {
            ctx.response.body = await this._getMintRecordByTx(ctx);
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

        router.get("/hash_weight/:hash", async (ctx) => {
            ctx.response.body = await this._getHashWeight(ctx);
        });

        router.get("/indexer/state_detail", async (ctx) => {
            ctx.response.body = await this._getIndexerStateDetail(ctx);
        });

        return 0;
    }
}

module.exports = {
    MintService
}; 