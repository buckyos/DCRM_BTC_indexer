const assert = require('assert');
const { OrdClient } = require('../btc/ord');
const { SatPoint } = require('../btc/point');
const { BigNumberUtil, Util } = require('../util');

const InscriptionOp = {
    Mint: 'mint',
    Transfer: 'transfer',
    Inscribe: 'inscribe',
    Chant: 'chant',
    SetPrice: 'setPrice',
    Resonance: 'resonance',

    /**
     *
     * @param {string} op
     * @returns {boolean}
     */
    contains: (op) => {
        return Object.values(InscriptionOp).includes(op);
    },

    /**
     *
     * @param {string} op
     * @returns {boolean}
     */
    need_track_transfer: (op) => {
        switch (op) {
            case InscriptionOp.Transfer:
            case InscriptionOp.Inscribe:
                return true;
            default:
                return false;
        }
    },
};

class MintOp {
    constructor(amt, lucky) {
        assert(_.isString(amt), `amt should be string`);
        assert(
            lucky == null || _.isString(lucky),
            `lucky should be string or null`,
        );

        this.op = InscriptionOp.Mint;
        this.amt = amt;
        this.lucky = lucky;
    }

    static parse_content(content) {
        assert(_.isObject(content), `mint content should be object`);

        const { amt, lucky } = content;

        // check amt
        if (!BigNumberUtil.is_positive_number_string(amt)) {
            console.warn(`invalid mint content amt ${amt} ${typeof amt}`);
            return { ret: 0, valid: false };
        }

        // check lucky if exists
        if (lucky != null) {
            if (!_.isString(lucky)) {
                console.error(`invalid content lucky value: ${lucky}`);
                return { ret: 0, valid: false };
            }

            if (lucky.length > 32) {
                console.error(`invalid content lucky value: ${lucky}`);
                return { ret: 0, valid: false };
            }
        }

        const item = new MintOp(amt, lucky);
        return { ret: 0, valid: true, item };
    }
}

class InscribeDataOp {
    constructor(ph, text, amt, price) {
        assert(_.isString(ph), `ph should be string`);
        assert(
            text == null || _.isString(text),
            `text should be string or null`,
        );
        assert(_.isString(amt), `amt should be string`);
        assert(_.isString(price), `price should be string`);

        this.op = InscriptionOp.Inscribe;
        this.ph = ph;
        this.text = text;
        this.amt = amt;
        this.price = price;
    }

    /**
     *
     * @param {object} content
     * @returns {{ret: number, valid: boolean, item: InscribeDataOp}}
     */
    static parse_content(content) {
        assert(_.isObject(content), `inscribe content should be object`);

        let { ph, text, amt, price } = content;

        // check ph
        if (!_.isString(ph)) {
            console.warn(`invalid inscribe content ph ${ph}`);
            return { ret: 0, valid: false };
        }

        if (!Util.is_valid_mixhash(ph)) {
            console.warn(`invalid inscribe content ph ${ph}`);
            return { ret: 0, valid: false };
        }

        // check text
        if (text != null) {
            if (!_.isString(text)) {
                console.warn(`invalid inscribe content text ${text}`);
                return { ret: 0, valid: false };
            }
        }
        // check amt
        if (!BigNumberUtil.is_positive_number_string(amt)) {
            console.warn(`invalid inscribe content amt ${amt}`);
            return { ret: 0, valid: false };
        }

        // check price
        if (price != null) {
            if (!BigNumberUtil.is_positive_number_string(price)) {
                console.warn(`invalid inscribe content price ${price}`);
                return { ret: 0, valid: false };
            }
        } else {
            content.price = '0';
            price = '0';
        }

        const item = new InscribeDataOp(ph, text, amt, price);
        return { ret: 0, valid: true, item };
    }
}

class TransferOp {
    constructor(amt) {
        assert(_.isString(amt), `amt should be string`);

        this.op = InscriptionOp.Transfer;
        this.amt = amt;
    }

    static parse_content(content) {
        assert(_.isObject(content), `transfer content should be object`);

        const { amt } = content;

        // check amt
        if (!BigNumberUtil.is_positive_number_string(amt)) {
            console.error(`invalid transfer content amt ${amt}`);
            return { ret: 0, valid: false };
        }

        const item = new TransferOp(amt);
        return { ret: 0, valid: true, item };
    }
}

class ChantOp {
    constructor(ph) {
        assert(_.isString(ph), `ph should be string`);

        this.op = InscriptionOp.Chant;
        this.ph = ph;
    }

    static parse_content(content) {
        assert(_.isObject(content), `chant content should be object`);

        const { ph } = content;

        // check ph
        if (!_.isString(ph)) {
            console.error(`invalid chant content ph ${ph}`);
            return { ret: 0, valid: false };
        }

        if (!Util.is_valid_mixhash(ph)) {
            console.error(`invalid chant content ph ${ph}`);
            return { ret: 0, valid: false };
        }

        const item = new ChantOp(ph);
        return { ret: 0, valid: true, item };
    }
}

class SetPriceOp {
    constructor() {
        this.op = InscriptionOp.SetPrice;
    }

    /**
     *
     * @param {object} content
     * @returns {ret: number, valid: boolean, item: SetPriceOp}
     */
    static parse_content(content) {
        assert(_.isObject(content), `setPrice content should be object`);

        // do not check content here any more
        // we should check content in the later process to record the error

        const item = new SetPriceOp();

        return { ret: 0, valid: true, item };
    }
}

class ResonanceOp {
    constructor() {
        this.op = InscriptionOp.Resonance;
    }

    /**
     *
     * @param {object} content
     * @returns {ret: number, valid: boolean, item: ResonanceOp}
     */
    static parse_content(content) {
        assert(_.isObject(content), `resonance content should be object`);

        // do not check content here any more
        // we should check content in the later process to record the error

        const item = new ResonanceOp();
        return { ret: 0, valid: true, item };
    }
}

// check content type at first
const valid_content_types = [
    'text/plain;charset=utf-8',
    'text/plain',
    'application/json',
];

class InscriptionContentLoader {
    static async _load_content_data_with_test(
        ord_client,
        inscription_id,
        content_type,
    ) {
        let data;
        if (
            content_type == null ||
            !valid_content_types.includes(content_type.toLowerCase())
        ) {
            console.debug(
                `invalid inscription content type ${content_type} ${inscription_id}`,
            );

            const { InscribeDataOpGenerator } = require('../test/ops_gen');
            const gen = new InscribeDataOpGenerator();
            data = gen.gen_content(null);
        } else {
            // fetch inscription content
            const { ret, data: _data } =
                await ord_client.get_content_by_inscription(inscription_id);
            if (ret !== 0) {
                console.error(`failed to get content ${inscription_id}`);
                return { ret };
            }

            if (data == null) {
                return { ret: 0, valid: false };
            }

            data = _data;
        }

        return { ret: 0, valid: true, data };
    }

    static async _load_content_data(ord_client, inscription_id, content_type) {
        // check content type at first
        if (
            content_type == null ||
            !valid_content_types.includes(content_type.toLowerCase())
        ) {
            console.debug(
                `invalid inscription content type ${content_type} ${inscription_id}`,
            );

            return { ret: 0, valid: false };
        }

        // fetch inscription content
        const { ret, data } = await ord_client.get_content_by_inscription(
            inscription_id,
        );
        if (ret !== 0) {
            console.error(`failed to get content ${inscription_id}`);
            return { ret };
        }

        if (data == null) {
            return { ret: 0, valid: false };
        }

        return { ret: 0, valid: true, data };
    }

    /**
     *
     * @param {OrdClient} ord_client
     * @param {string} inscription_id
     * @param {string} content_type
     * @param {object} config
     * @returns {Promise<{ret: number, valid: boolean, content: object, op: object}>}
     */
    static async load_content(
        ord_client,
        inscription_id,
        content_type,
        config,
    ) {
        assert(
            ord_client instanceof OrdClient,
            `ord_client should be OrdClient`,
        );
        assert(_.isString(inscription_id), `inscription_id should be string`);
        assert(
            content_type == null || _.isString(content_type),
            `content_type should be string or null: ${content_type}`,
        );
        assert(_.isObject(config), `config should be object`);

        const {
            ret: load_content_ret,
            valid: load_content_valid,
            data,
        } = await this._load_content_data(
            ord_client,
            inscription_id,
            content_type,
        );
        if (load_content_ret !== 0) {
            console.error(
                `failed to load inscription content ${inscription_id}`,
            );
            return { ret: load_content_ret };
        }

        if (!load_content_valid) {
            return { ret: 0, valid: false };
        }

        // data that is object or string that parsed as valid object is valid
        let content;
        if (typeof data === 'string') {
            try {
                content = JSON.parse(data);
            } catch (err) {
                console.debug(
                    `invalid json format inscription content ${inscription_id} ${data}, ${err}`,
                );
                return {
                    ret: 0,
                    valid: false,
                };
            }
        } else if (data != null && typeof data === 'object') {
            content = data;
        } else {
            console.debug(
                `invalid inscription content ${inscription_id} ${data}`,
            );
            return {
                ret: 0,
                valid: false,
            };
        }

        assert(
            typeof content === 'object',
            `invalid inscription content ${content}`,
        );

        // try fix some fields
        if (_.isString(data.ph)) {
            const { valid, mixhash } = Util.check_and_fix_mixhash(data.ph);
            if (valid) {
                data.ph = mixhash;
            } else {
                // FIXME should we stop here and no more process?
            }
        }

        // parse content
        const {
            ret: parse_ret,
            valid,
            item,
        } = this.parse_content(inscription_id, content, config);
        if (parse_ret !== 0) {
            console.error(
                `failed to parse content ${inscription_id} ${content}`,
            );
            return { ret: parse_ret };
        }

        return { ret: 0, valid, content, op: item };
    }

    /**
     *
     * @param {string} inscription_id
     * @param {object} content
     * @param {object} config
     * @returns {{ret: number, valid: boolean, item: object}}
     */
    static parse_content(inscription_id, content, config) {
        if (content == null || content.p == null) {
            return { ret: 0, valid: false };
        }

        if (!_.isString(content.p)) {
            return { ret: 0, valid: false };
        }

        const p = content.p.toLowerCase();

        // The first deployment of a ticker is the only one that has claim to the ticker. Tickers are not case sensitive (DOGE = doge).
        if (p === 'brc-20') {
            // first should check if token name is matched
            assert(
                _.isString(config.token.token_name),
                `invalid config token name`,
            );
            if (
                content.tick == null ||
                content.tick.toLowerCase() !==
                    config.token.token_name.toLowerCase()
            ) {
                return { ret: 0, valid: false };
            }
        }

        return this.parse_content_without_check(inscription_id, content);
    }

    /**
     *
     * @param {string} inscription_id
     * @param {object} content
     * @returns {Promise<{ret: number, valid: boolean, item: object}>}
     */
    static parse_content_without_check(inscription_id, content) {
        const p = content.p.toLowerCase();

        if (p === 'brc-20') {
            if (content.op === 'mint') {
                return MintOp.parse_content(content);
            } else if (content.op === 'transfer') {
                if (content.call === 'pdi-inscribe') {
                    return InscribeDataOp.parse_content(content);
                } else if (content.call === 'pdi-res') {
                    return ResonanceOp.parse_content(content);
                }

                return TransferOp.parse_content(content);
            } else if (content.op === 'deploy') {
                // TODO: check if deploy inscription is matched
            } else {
                console.warn(
                    `unknown brc-20 op ${inscription_id} ${
                        p.op
                    } ${JSON.stringify(content)}`,
                );
            }
        } else if (p === 'pdi') {
            if (content.op === 'inscribe') {
                return InscribeDataOp.parse_content(content);
            } else if (content.op === 'chant') {
                return ChantOp.parse_content(content);
            } else if (content.op === 'set') {
                return SetPriceOp.parse_content(content);
            } else if (content.op === 'res') {
                return ResonanceOp.parse_content(content);
            } else {
                console.warn(
                    `unknown pdi op ${inscription_id} ${
                        content.op
                    } ${JSON.stringify(content)}`,
                );
            }
        }

        return { ret: 0, valid: false };
    }
}

class InscriptionNewItem {
    /**
     *
     * @param {string} inscription_id
     * @param {number} inscription_number
     * @param {number} block_height
     * @param {number} timestamp
     * @param {string} address // the creator address
     * @param {SatPoint} satpoint
     * @param {number} value
     * @param {object} content
     * @param {object} op
     * @param {string} commit_txid
     */
    constructor(
        inscription_id,
        inscription_number,
        block_height,
        timestamp,
        address, // the creator address
        satpoint,
        value,
        content,
        op,
        commit_txid, // the txid in the inscription commit transaction (two phase commit and reveal)
    ) {
        assert(_.isString(inscription_id), `inscription_id should be string`);
        assert(
            _.isNumber(inscription_number),
            `inscription_number should be number`,
        );
        assert(_.isNumber(block_height), `block_height should be number`);
        assert(_.isNumber(timestamp), `timestamp should be number`);

        assert(_.isObject(content), `content should be object`);
        assert(_.isObject(op), `op should be object`);
        assert(satpoint instanceof SatPoint, `satpoint should be SatPoint`);
        assert(_.isString(commit_txid), `commit_txid should be string`);

        this.inscription_id = inscription_id;
        this.inscription_number = inscription_number;
        this.block_height = block_height;
        this.timestamp = timestamp;
        this.address = address;
        this.satpoint = satpoint;
        this.value = value;
        this.content = content;
        this.op = op;
        this.commit_txid = commit_txid;
    }

    /**
     * @returns {string}
     */
    get txid() {
        assert(_.isObject(this.satpoint), `satpoint should be string`);

        return this.satpoint.outpoint.txid;
    }
}

class InscriptionTransferItem {
    /**
     *
     * @param {string} inscription_id
     * @param {number} inscription_number
     * @param {number} block_height
     * @param {number} timestamp
     * @param {SatPoint} satpoint
     * @param {string} from_address
     * @param {string} to_address
     * @param {number} value
     * @param {object} content
     * @param {object} op
     * @param {number} index
     */
    constructor(
        inscription_id,
        inscription_number,
        block_height,
        timestamp,
        satpoint,
        from_address,
        to_address,
        value,
        content,
        op,
        index, // index Indicates the number of transfers
    ) {
        assert(_.isString(inscription_id), `inscription_id should be string`);
        assert(
            _.isNumber(inscription_number),
            `inscription_number should be number`,
        );
        assert(_.isNumber(block_height), `block_height should be number`);
        assert(_.isNumber(timestamp), `timestamp should be number`);
        assert(
            satpoint instanceof SatPoint,
            `satpoint should be SatPoint ${satpoint}`,
        );
        assert(
            from_address == null || _.isString(from_address),
            `from_address should be string or null`,
        );
        assert(
            to_address == null || _.isString(to_address),
            `to_address should be string or null`,
        );
        assert(_.isNumber(value), `value should be number`);
        assert(_.isObject(content), `content should be object`);
        assert(_.isObject(op), `op should be object`);
        assert(_.isNumber(index), `index should be number`);
        assert(index >= 0, `index should be >= 0: ${index}`);

        this.inscription_id = inscription_id;
        this.inscription_number = inscription_number;
        this.block_height = block_height;
        this.timestamp = timestamp;
        this.satpoint = satpoint;

        this.from_address = from_address;
        this.to_address = to_address;
        this.value = value;

        this.content = content;
        this.op = op;

        this.index = index;
    }

    /**
     * @comment set the previous satpoint for later use
     * @param {SatPoint} prev_satpoint
     */
    set_prev_satpoint(prev_satpoint) {
        assert(
            prev_satpoint instanceof SatPoint,
            `invalid prev_satpoint ${prev_satpoint}`,
        );

        assert(this.prev_satpoint == null, `prev_satpoint already set`);
        this.prev_satpoint = prev_satpoint;
    }

    /**
     * @returns {string}
     */
    get txid() {
        assert(this.satpoint instanceof SatPoint, `invalid satpoint`);

        return this.satpoint.outpoint.txid;
    }
}

class BlockInscriptionCollector {
    constructor(block_height) {
        assert(_.isNumber(block_height), `invalid block_height`);

        this.block_height = block_height;
        this.new_inscriptions = [];
        this.inscription_transfers = [];
    }

    is_empty() {
        return (
            this.new_inscriptions.length === 0 &&
            this.inscription_transfers.length === 0
        );
    }

    add_new_inscription(new_inscription) {
        assert(
            new_inscription instanceof InscriptionNewItem,
            `invalid new_inscription`,
        );

        this.new_inscriptions.push(new_inscription);
    }

    add_new_inscriptions(new_inscriptions) {
        assert(_.isArray(new_inscriptions), `invalid new_inscriptions`);

        this.new_inscriptions.push(...new_inscriptions);
    }

    add_inscription_transfer(inscription_transfer) {
        assert(
            inscription_transfer instanceof InscriptionTransferItem,
            `invalid inscription_transfer`,
        );

        this.inscription_transfers.push(inscription_transfer);
    }

    add_inscription_transfers(inscription_transfers) {
        assert(
            _.isArray(inscription_transfers),
            `invalid inscription_transfers`,
        );

        this.inscription_transfers.push(...inscription_transfers);
    }
}

module.exports = {
    InscriptionOp,
    InscriptionContentLoader,
    TransferOp,
    MintOp,
    InscribeDataOp,
    ChantOp,
    SetPriceOp,
    ResonanceOp,

    InscriptionNewItem,
    InscriptionTransferItem,
    BlockInscriptionCollector,
};
