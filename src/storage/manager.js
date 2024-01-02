const { InscriptionTransferStorage } = require('./transfer');
const { InscriptionsStorage } = require('./inscriptions');
const { Util } = require('../util');

// inscriptions manager, manager all inscriptions and their transfers
class InscriptionsManager {
    constructor(config) {
        this.config = config;

        const { ret, dir } = Util.get_data_dir(config);
        if (ret !== 0) {
            throw new Error(`failed to get data dir`);
        }

        this.inscription_storage = new InscriptionsStorage(dir);
        this.inscription_transfer_storage = new InscriptionTransferStorage(dir);
    }

    async init() {
        const { ret: init_ret } = await this.inscription_storage.init();
        if (init_ret !== 0) {
            console.error(`failed to init inscription storage`);
            return { ret: init_ret };
        }

        const { ret: init_transfer_ret } =
            await this.inscription_transfer_storage.init();
        if (init_transfer_ret !== 0) {
            console.error(`failed to init inscription transfer storage`);
            return { ret: init_transfer_ret };
        }

        return { ret: 0 };
    }
}

module.exports = { InscriptionsManager };
