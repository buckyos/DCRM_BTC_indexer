const assert = require('assert');
const { BTCClient } = require('../btc/btc');
const { OrdClient } = require('../btc/ord');
const { InscriptionLogStorage } = require('../storage/log');
const { Util } = require('../util');
const { TokenIndex } = require('./token');

class InscriptionIndex {
    constructor(config) {
        this.config = config;
        this.btc_client = new BTCClient(
            config.btc.host,
            config.btc.network,
            config.btc.auth,
        );
        this.ord_client = new OrdClient(config.ord.server_url);

        const { ret, dir } = Util.get_data_dir(config);
        if (ret !== 0) {
            throw new Error(`failed to get data dir`);
        }

        this.storage = new InscriptionLogStorage(dir);
        this.current_block_height = 0;

        this.token_index = new TokenIndex(config);
    }

    // run forever
    async run() {
        const { ret: init_ret } = await this.storage.init();
        if (init_ret !== 0) {
            console.error(`failed to init inscription log storage`);
            return;
        }

        while (true) {
            if (this.current_block_height === 0) {
                // get latest block height already synced
                const { ret, height } =
                    await this.storage.get_latest_block_height();
                if (ret !== 0) {
                    console.error(`failed to get latest block height`);
                    await this.sleep(1000 * 5);
                    continue;
                }

                // get config start block height that should be synced
                assert(
                    _.isNumber(this.config.token.genesis_block_height),
                    `invalid start block height`,
                );

                this.current_block_height =
                    height > this.config.token.genesis_block_height
                        ? height
                        : this.config.token.genesis_block_height;
                console.info(
                    `sync will start at block height ${this.current_block_height}`,
                );
            }

            assert(
                this.current_block_height > 0,
                `invalid block height ${this.current_block_height}`,
            );

            const { ret } = await this.sync_once();
            if (ret !== 0) {
                console.error(`failed to sync once`);
                await Util.sleep(1000 * 5);
                continue;
            } else {
                await Util.sleep(1000 * 10);
            }
        }
    }

    // sync once
    async sync_once() {
        const { ret, height } = await this.btc_client.get_latest_block_height();
        if (ret !== 0) {
            console.error(`failed to get latest block height`);
            return { ret };
        }

        assert(_.isNumber(height), `invalid block height ${height}`);
        assert(
            _.isNumber(this.current_block_height),
            `invalid block height ${this.current_block_height}`,
        );

        if (this.current_block_height >= height) {
            console.assert(
                this.current_block_height === height,
                `invalid block height ${this.current_block_height} ${height}`,
            );
            return { ret: 0 };
        }

        {
            const { ret } = await this.sync_blocks(
                this.current_block_height,
                height + 1,
            );
            if (ret !== 0) {
                console.error(
                    `failed to sync blocks [${this.current_block_height}, ${
                        height + 1
                    })`,
                );
                return { ret };
            }
        }

        this.current_block_height = height + 1;
        return { ret: 0 };
    }

    // try sync block for range [begin, end)
    async sync_blocks(begin, end) {
        console.assert(begin < end, `invalid block range [${begin}, ${end})`);

        for (let i = begin; i < end; i++) {
            const { ret } = await this.sync_block(i);
            if (ret !== 0) {
                console.error(`failed to sync block ${i}`);
                return { ret };
            }

            // update latest block height
            {
                const { ret } = await this.storage.update_latest_block_height(
                    i,
                );
                if (ret !== 0) {
                    console.error(`failed to update latest block height ${i}`);
                    return { ret };
                }
            }
        }
    }

    async sync_block(block_height) {
        console.info(`syncing block ${block_height}`);

        const { ret, data } = await this.ord_client.get_inscription_by_block(
            block_height,
        );
        if (ret !== 0) {
            console.error(
                `failed to get inscription list by block ${block_height}`,
            );
            return { ret };
        }

        if (data.inscriptions.length === 0) {
            console.info(`no inscription in block ${block_height}`);
            return { ret: 0 };
        }

        // process inscriptions in block one by one
        const block_inscriptions = [];
        for (let i = 0; i < data.inscriptions.length; i++) {
            const inscription_id = data.inscriptions[i];

            // fetch inscription by id
            const { ret: get_ret, inscription } =
                await this.ord_client.get_inscription(inscription_id);
            if (get_ret !== 0) {
                console.error(`failed to get inscription ${inscription_id}`);
                return { ret: get_ret };
            }

            assert(
                inscription.genesis_height === block_height,
                `invalid inscription genesis block height: ${inscription.genesis_height} !== ${block_height}`,
            );

            // filter invalid inscription
            let inscription_content;
            {
                const { ret, valid, content } = await this.check_inscription(
                    block_height,
                    inscription_id,
                    inscription,
                );
                if (ret !== 0) {
                    console.error(
                        `failed to check inscription ${inscription_id}`,
                    );
                    return { ret };
                }

                if (!valid) {
                    continue;
                }

                assert(content != null, `invalid inscription content`);
                inscription_content = content;
            }

            console.log(
                `got inscription block: ${block_height}, ${inscription_id}, ${
                    inscription.content_type
                }, ${JSON.stringify(inscription_content)}`,
            );

            let txid;
            {
                const ret = Util.parse_inscription_id(inscription_id);
                if (ret.ret !== 0) {
                    console.error(
                        `failed to parse inscription id ${inscription_id}`,
                    );
                    return ret;
                }

                assert(_.isString(ret.txid), `invalid txid ${ret.txid}`);
                txid = ret.txid;
            }

            // only retive prev txid for inscribe op
            let prev_txid;
            if (this.is_content_inscribe_op(inscription_content)) {
                // should get prev input txid

                // get transaction
                const { ret: get_tx_ret, tx } =
                    await this.btc_client.get_transaction(txid);
                if (get_tx_ret !== 0) {
                    console.error(`failed to get transaction ${txid}`);
                    return { ret: get_tx_ret };
                }

                // get prev txid
                prev_txid = tx.vin[0].txid;
            }

            // get output utxo
            let output_utxo;
            {
                const {
                    ret: ret_parser,
                    outpoint,
                    offset,
                } = Util.parse_sat_point(inscription.satpoint);
                if (ret_parser !== 0) {
                    console.error(
                        `failed to parse satpoint ${inscription_id}, ${inscription.satpoint}`,
                    );
                    return { ret: ret_parser };
                }

                const { ret, data: data } =
                    await this.ord_client.get_output_by_outpoint(outpoint);
                if (ret !== 0) {
                    console.error(
                        `failed to get output ${inscription_id} ${outpoint}`,
                    );
                    return { ret };
                }

                assert(
                    data.inscriptions.includes(inscription_id),
                    `unmatched inscription id ${data.inscriptions[offset]} !== ${inscription_id}`,
                );
                output_utxo = data;
            }

            assert(
                _.isString(output_utxo.address),
                `invalid output address ${inscription_id} ${output_utxo.address}`,
            );

            // record inscription
            {
                const { ret } = await this.storage.log_inscription(
                    block_height,
                    i,
                    txid,
                    inscription_id,
                    inscription.address,
                    output_utxo.address,
                    inscription_content,
                );
                if (ret !== 0) {
                    console.error(
                        `failed to log inscription ${inscription_id}`,
                    );
                    return { ret };
                }
            }

            // index inscription
            const inscription_item = {
                block_height,
                timestamp: inscription.timestamp,
                inscription_index: i,
                txid,
                prev_txid,
                inscription_id,
                address: inscription.address,
                output_address: output_utxo.address,
                content: inscription_content,
            };

            block_inscriptions.push(inscription_item);
        }

        if (block_inscriptions.length > 0) {
            const { ret } = await this.on_block_inscriptions(
                block_height,
                block_inscriptions,
            );
            if (ret !== 0) {
                console.error(
                    `failed to index inscriptions in block ${block_height}`,
                );
                return { ret };
            }
        }

        console.info(`synced block ${block_height}`);
        return { ret: 0 };
    }

    /**
     * 
     * @param {number} block_height 
     * @param {string} inscription_id 
     * @param {object} inscription 
     * @returns {Promise<{ret: number, valid: boolean, content: object}>}
     */
    async check_inscription(block_height, inscription_id, inscription) {
        console.info(`checking inscription ${block_height} ${inscription_id}`);

        // check content type at first
        const valid_content_types = [
            'text/plain;charset=utf-8',
            'text/plain',
            'application/json',
        ];
        if (
            !valid_content_types.includes(
                inscription.content_type.toLowerCase(),
            )
        ) {
            console.debug(
                `invalid inscription content type ${inscription.content_type}`,
            );
            return {
                ret: 0,
                valid: false,
            };
        }

        const { ret, data } = await this.ord_client.get_content_by_inscription(
            inscription_id,
        );
        if (ret !== 0) {
            console.error(`failed to get content ${inscription_id}`);
            return { ret };
        }

        // data that is object or string that parsed as valid object is valid
        let content;
        if (typeof data === 'string') {
            try {
                content = JSON.parse(data);
            } catch (e) {
                console.debug(
                    `invalid json format inscription content ${data}`,
                );
                return {
                    ret: 0,
                    valid: false,
                };
            }
        } else if (typeof data === 'object') {
            content = data;
        } else {
            console.debug(`invalid inscription content ${data}`);
            return {
                ret: 0,
                valid: false,
            };
        }

        assert(
            typeof content === 'object',
            `invalid inscription content ${content}`,
        );

        if (!this.check_content(content)) {
            console.debug(
                `unknown inscription content  ${JSON.stringify(content)}`,
            );
            return {
                ret: 0,
                valid: false,
            };
        }

        // check price if exists
        if (content.price != null) {
            if (!_.isNumber(content.price)) {
                console.error(`invalid content price value: ${content.price}`);
                return { ret: 0, valid: false };
            }
        }

        // check amt if exists
        if (content.amt != null) {
            if (!_.isNumber(content.amt)) {
                console.error(`invalid content amt value: ${content.amt}`);
                return { ret: 0, valid: false };
            }
        }

        // check text if exists
        if (content.text != null) {
            if (!_.isString(content.text)) {
                console.error(`invalid content text value: ${content.text}`);
                return { ret: 0, valid: false };
            }
        }

        // check lucky if exists
        if (content.lucky != null) {
            if (!_.isString(content.lucky)) {
                console.error(`invalid content lucky value: ${content.lucky}`);
                return { ret: 0, valid: false };
            }
        }

        // try fix the ph, if encoded in hex, convert to base58
        if (content.ph != null) {
            if (!_.isString(content.ph)) {
                console.error(`invalid content hash value: ${content.ph}`);
                return { ret: 0, valid: false };
            }

            const { ret, hash_str } = Util.hex_to_base58(content.ph);
            if (ret !== 0) {
                console.error(`invalid content hash value: ${content.ph}`);
                return { ret: 0, valid: false };
            }

            content.ph = hash_str;
        }

        return {
            ret: 0,
            valid: true,
            content,
        };
    }

    /**
     *
     * @param {object} content
     * @returns {boolean}
     */
    check_content(content) {
        if (content.p == null) {
            return false;
        }

        if (!_.isString(content.p)) {
            return false;
        }

        if (content.p.toLowerCase() === 'brc-20') {
            assert(
                _.isString(this.config.token.token_name),
                `invalid token name config ${this.config.token.token_name}`,
            );

            if (content.tick == this.config.token.token_name) {
                return true;
            }
        } else if (content.p.toLowerCase() === 'pdi') {
            return true;
        }

        return false;
    }

    /**
     * check if content is inscribe op
     * @param {object} content
     * @returns {boolean}
     */
    is_content_inscribe_op(content) {
        if (content.op != null && content.op.toLowerCase() == 'inscribe') {
            return true;
        }
        if (
            content.call != null &&
            content.call.toLowerCase() == 'pdi-inscribe'
        ) {
            return true;
        }

        return false;
    }
    /**
     * Handles an inscription item.
     *
     * @param {Object} inscription_item - The inscription item to handle.
     * @param {number} inscription_item.block_height - The block height of the inscription.
     * @param {number} inscription_item.timestamp - The timestamp of the inscription.
     * @param {number} inscription_item.inscription_index - The index of the inscription.
     * @param {string} inscription_item.txid - The transaction ID of the inscription.
     * @param {string} inscription_item.prev_txid - The previous transaction ID of the inscription.
     * @param {string} inscription_item.inscription_id - The ID of the inscription.
     * @param {string} inscription_item.address - The address of the inscription.
     * @param {string} inscription_item.output_address - The output address of the inscription.
     * @param {Object} inscription_item.content - The content of the inscription.
     * @returns {Promise<{ret: number}>}
     */
    async on_block_inscriptions(block_height, block_inscriptions) {
        console.info(
            `indexing inscriptions at block ${block_height} count ${block_inscriptions.length}`,
        );

        return { ret: 0 };
    }
}

module.exports = { InscriptionIndex };
