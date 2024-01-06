const { ETHIndex } = require('../eth/index');
const { InscriptionIndex } = require('./inscription');


class InscriptionIndexExecutor {
    constructor(config) {
        this.eth_index = new ETHIndex(config);
        this.inscription_index = new InscriptionIndex(config);
    }

    async init() {
        const { ret: eth_ret } = await this.eth_index.init();
        if (eth_ret !== 0) {
            console.error(`failed to init eth index`);
            return { ret: eth_ret };
        }

        const { ret: inscription_index_ret } =
            await this.inscription_index.init(this.eth_index);
        if (inscription_index_ret !== 0) {
            console.error(`failed to init inscription index`);
            return { ret: inscription_index_ret };
        }

        return { ret: 0 };
    }

    async run() {
        // run both eth index and inscription index forever
        const eth_index_promise = this.eth_index.run();
        const inscription_index_promise = this.inscription_index.run();
        await Promise.all([eth_index_promise, inscription_index_promise]);
    }
}

module.exports = { InscriptionIndexExecutor };
