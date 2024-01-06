const assert = require('assert');
const {
    InscriptionNewItem,
    InscriptionTransferItem,
    InscriptionContentLoader,
    BlockInscriptionCollector,
} = require('../index/item');
const { InscriptionsManager } = require('../storage/manager');
const { SatPoint } = require('../btc/point');


// load inscriptions from db by block
class InscriptionsStorageLoader {
    constructor(config) {
        this.config = config;

        this.inscriptions_manager = new InscriptionsManager(config);
    }

    async init() {
        const { ret } = await this.inscriptions_manager.init();
        if (ret !== 0) {
            console.error(`failed to init inscriptions manager`);
            return { ret };
        }

        return { ret: 0 };
    }

    async load_items_by_block(block_height) {
        assert(_.isNumber(block_height), `invalid block_height: ${block_height}`);
        assert(block_height > 0, `invalid block_height: ${block_height}`);

        const { ret, inscriptions } =
            await this._load_inscriptions_by_block(block_height);
        if (ret !== 0) {
            console.error(`failed to load inscriptions by block ${block_height}`);
            return { ret };
        }

        const { ret: transfer_ret, transfers } =
            await this._load_inscriptions_transfer_by_block(block_height);
        if (transfer_ret !== 0) {
            console.error(
                `failed to load inscriptions transfer by block ${block_height}`,
            );
            return { ret: transfer_ret };
        }

        const collector = new BlockInscriptionCollector(block_height);
        collector.add_new_inscriptions(inscriptions);
        collector.add_inscription_transfers(transfers);

        return { ret: 0, collector };
    }

    async _load_inscriptions_by_block(block_height) {
        const { ret, inscriptions } =
            await this.inscriptions_manager.inscription_storage.get_inscriptions_by_block(
                block_height,
            );
        if (ret !== 0) {
            console.error(
                `failed to get inscriptions by block ${block_height}`,
            );
            return { ret };
        }

        const inscription_items = [];
        for (const inscription of inscriptions) {
            assert(_.isString(inscription.content), `invalid content: ${inscription.content}`);
            const content = JSON.parse(inscription.content);
            
            const {ret, valid, item: op} = InscriptionContentLoader.parse_content_without_check(
                inscription.inscription_id,
                content
            );

            // parse satpoint
            const {ret: parse_ret, satpoint} = SatPoint.parse(inscription.genesis_satpoint);
            if (parse_ret !== 0) {
                console.error(`failed to parse satpoint ${inscription.genesis_satpoint}`);
                return { ret: parse_ret };
            }

            assert(ret === 0, `failed to parse content: ${content}`);
            assert(valid, `invalid content: ${content}`);
            assert(_.isObject(op), `invalid op: ${op}`);

            const item = new InscriptionNewItem(
                inscription.inscription_id,
                inscription.inscription_number,

                inscription.genesis_block_height,
                inscription.genesis_timestamp,
                inscription.creator,
                satpoint,
                inscription.value,
                
                content,
                op,
                inscription.commit_txid,
            );

            inscription_items.push(item);
        }
        
        return { ret: 0, inscriptions: inscription_items };
    }

    async _load_inscriptions_transfer_by_block(block_height) {
        const { ret, transfers } =
            await this.inscriptions_manager.inscription_transfer_storage.get_inscription_transfer_by_block(
                block_height,
            );
        if (ret !== 0) {
            console.error(
                `failed to get inscriptions transfer by block ${block_height}`,
            );
            return { ret };
        }

        const inscription_transfer_items = [];
        for (const transfer of transfers) {
            assert(_.isString(transfer.inscription_id), `invalid inscription_id: ${transfer.inscription_id}`);

            // load content from inscription storage
            const { ret: content_ret, content } =
                await this.inscriptions_manager.inscription_storage.get_inscription_content(
                    transfer.inscription_id,
                );
            if (content_ret !== 0) {
                console.error(
                    `failed to get inscription content by id ${transfer.inscription_id}`,
                );
                return { ret: content_ret };
            }

            if (content === null) {
                console.error(
                    `get inscription content by id but not found ${transfer.inscription_id}`,
                );
                return { ret: -1 };
            }

            assert(_.isString(content), `invalid content: ${transfer.content}`);
            const content_obj = JSON.parse(content);
            
            const {ret, valid, item: op} = InscriptionContentLoader.parse_content_without_check(
                transfer.inscription_id,
                content_obj
            );

            // parse satpoint 
            const {ret: parse_ret, satpoint} = SatPoint.parse(transfer.satpoint);
            if (parse_ret !== 0) {
                console.error(`failed to parse satpoint ${transfer.satpoint}`);
                return { ret: parse_ret };
            }

            assert(ret === 0, `failed to parse content: ${content}`);
            assert(valid, `invalid content: ${content}`);
            assert(_.isObject(op), `invalid op: ${op}`);

            const item = new InscriptionTransferItem(
                transfer.inscription_id,
                transfer.inscription_number,

                transfer.block_height,
                transfer.timestamp,
                satpoint,
                transfer.from_address,
                transfer.to_address,
                transfer.value,
                content_obj,
                op,
                transfer.idx,
            );

            inscription_transfer_items.push(item);
        }
        
        return { ret: 0, transfers: inscription_transfer_items };
    }
}


module.exports = { InscriptionsStorageLoader };