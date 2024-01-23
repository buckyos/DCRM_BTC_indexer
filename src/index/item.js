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
    constructor() {
        this.op = InscriptionOp.Mint;
    }

    static parse_content(content) {
        assert(_.isObject(content), `mint content should be object`);

      
        // do not check content here any more
        // we should check content in the later process to record the error
        // lucky field is optional and can be any value, but only if it's string then we can use it as lucky mint or burn mint

        const item = new MintOp();
        return { ret: 0, valid: true, item };
    }
}

class InscribeDataOp {
    constructor() {
        this.op = InscriptionOp.Inscribe;
    }

    /**
     *
     * @param {object} content
     * @returns {{ret: number, valid: boolean, item: InscribeDataOp}}
     */
    static parse_content(content) {
        assert(_.isObject(content), `inscribe content should be object`);

        const item = new InscribeDataOp();
        return { ret: 0, valid: true, item };
    }
}

class TransferOp {
    constructor() {
        this.op = InscriptionOp.Transfer;
    }

    static parse_content(content) {
        assert(_.isObject(content), `transfer content should be object`);

        const item = new TransferOp();
        return { ret: 0, valid: true, item };
    }
}

class ChantOp {
    constructor() {
        this.op = InscriptionOp.Chant;
    }

    static parse_content(content) {
        assert(_.isObject(content), `chant content should be object`);

        // do not check content here any more
        // we should check content in the later process to record the error

        const item = new ChantOp();
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

        // as_fee indicates whether this transfer is used as fee
        // we now treat the transfer as fee if the to_address is zero address
        this.as_fee = (to_address === Util.zero_btc_address());
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
