const assert = require('assert');
const { OrdClient } = require('../btc/ord');

const InscriptionOp = {
    Mint: 'mint',
    Transfer: 'transfer',
    Inscribe: 'inscribe',
    Chant: 'chant',
    SetPrice: 'setPrice',
    Resonance: 'resonance',
};

class MintOp {
    constructor(amt, lucky) {
        assert(_.isNumber(amt), `amt should be number`);
        assert(amt >= 0, `amt should be positive number`);
        assert(_.isBoolean(lucky), `lucky should be boolean`);

        this.op = InscriptionOp.Mint;
        this.amt = amt;
        this.lucky = lucky;
    }

    static parse_content(content) {
        assert(_.isObject(content), `mint content should be object`);

        const { amt, lucky } = obj;

        // check amt, must be number
        if (!_.isNumber(amt)) {
            console.error(`invalid mint content amt ${amt}`);
            return { ret: 0, valid: false };
        }

        // check lucky if exists
        if (lucky != null) {
            if (!_.isString(lucky)) {
                console.error(`invalid content lucky value: ${lucky}`);
                return { ret: 0, valid: false };
            }
        }

        const item = new MintOp(amt, lucky);
        return { ret: 0, valid: true, item };
    }
}

class InscribeOp {
    constructor(ph, text, amt, price) {
        assert(_.isString(ph), `ph should be string`);
        assert(
            text == null || _.isString(text),
            `text should be string or null`,
        );
        assert(_.isNumber(amt), `amt should be number`);
        assert(amt >= 0, `amt should be positive number`);
        assert(_.isNumber(price), `price should be number`);
        assert(price > 0, `price should be positive number`);

        this.op = InscriptionOp.Inscribe;
        this.ph = ph;
        this.text = text;
        this.amt = amt;
        this.price = price;
    }

    static parse_content(content) {
        assert(_.isObject(content), `inscribe content should be object`);

        const { ph, text, amt, price } = content;

        // check ph
        if (!_.isString(ph)) {
            console.error(`invalid inscribe content ph ${ph}`);
            return { ret: 0, valid: false };
        }

        // check text
        if (text != null) {
            if (!_.isString(text)) {
                console.error(`invalid inscribe content text ${text}`);
                return { ret: 0, valid: false };
            }
        }

        // check amt
        if (!_.isNumber(amt)) {
            console.error(`invalid inscribe content amt ${amt}`);
            return { ret: 0, valid: false };
        }

        // check price
        if (price != null) {
            if (!_.isNumber(price)) {
                console.error(`invalid inscribe content price ${price}`);
                return { ret: 0, valid: false };
            }
        }

        const item = new InscribeOp(ph, text, amt, price);
        return { ret: 0, valid: true, item };
    }
}

class TransferOp {
    constructor(amt) {
        assert(_.isNumber(amt), `amt should be number`);
        assert(amt >= 0, `amt should be positive number`);

        this.op = InscriptionOp.Transfer;
        this.amt = amt;
    }

    static parse_content(content) {
        assert(_.isObject(content), `transfer content should be object`);

        const { amt } = content;

        // check amt
        if (!_.isNumber(amt)) {
            console.error(`invalid transfer content amt ${amt}`);
            return { ret: 0, valid: false };
        }

        const item = new TransferOp(to, amt);
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

        const item = new ChantOp(ph);
        return { ret: 0, valid: true, item };
    }
}

class SetPriceOp {
    constructor(ph, price) {
        assert(_.isString(ph), `ph should be string`);
        assert(_.isNumber(price), `price should be number`);
        assert(price > 0, `price should be positive number`);

        this.op = InscriptionOp.SetPrice;
        this.ph = ph;
        this.price = price;
    }

    static parse_content(content) {
        assert(_.isObject(content), `setPrice content should be object`);

        const { ph, price } = content;

        // check ph
        if (!_.isString(ph)) {
            console.error(`invalid setPrice content ph ${ph}`);
            return { ret: 0, valid: false };
        }

        // check price
        if (!_.isNumber(price)) {
            console.error(`invalid setPrice content price ${price}`);
            return { ret: 0, valid: false };
        }

        const item = new SetPriceOp(ph, price);
        return { ret: 0, valid: true, item };
    }
}

class ResonanceOp {
    constructor(ph, amt) {
        assert(_.isString(ph), `ph should be string`);
        assert(_.isNumber(amt), `amt should be number`);
        assert(amt > 0, `amt should be positive number`);

        this.op = InscriptionOp.Resonance;
        this.ph = ph;
        this.amt = amt;
    }

    static parse_content(content) {
        assert(_.isObject(content), `resonance content should be object`);

        const { ph, amt } = content;

        // check ph
        if (!_.isString(ph)) {
            console.error(`invalid resonance content ph ${ph}`);
            return { ret: 0, valid: false };
        }

        // check amt
        if (!_.isNumber(amt)) {
            console.error(`invalid resonance content amt ${amt}`);
            return { ret: 0, valid: false };
        }

        const item = new ResonanceOp(ph, amt);
        return { ret: 0, valid: true, item };
    }
}

class InscriptionContentLoader {
    /**
     *
     * @param {OrdClient} ord_client
     * @param {string} inscription_id
     * @param {string} content_type
     * @returns {Promise<{ret: number, valid: boolean, content: object, op: InscriptionOp}>}
     */
    static async load_content(ord_client, inscription_id, content_type) {
        assert(
            ord_client instanceof OrdClient,
            `ord_client should be OrdClient`,
        );
        assert(_.isString(inscription_id), `inscription_id should be string`);
        assert(_.isString(content_type), `content_type should be string`);

        // check content type at first
        const valid_content_types = [
            'text/plain;charset=utf-8',
            'text/plain',
            'application/json',
        ];
        if (
            content_type == null ||
            !valid_content_types.includes(content_type.toLowerCase())
        ) {
            console.debug(
                `invalid inscription content type ${content_type} ${inscription_id}`,
            );
            return {
                ret: 0,
                valid: false,
            };
        }

        // fetch inscription content
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

        // parse content
        const {
            ret: parse_ret,
            valid,
            item,
        } = this.parse_content(inscription_id, content);
        if (parse_ret !== 0) {
            console.error(
                `failed to parse content ${inscription_id} ${content}`,
            );
            return { ret: parse_ret };
        }

        return { ret: 0, valid, content, op: item };
    }

    parse_content(inscription_id, content) {
        if (content.p == null) {
            return { ret: 0, valid: false };
        }

        if (!_.isString(content.p)) {
            return { ret: 0, valid: false };
        }

        const p = content.p.toLowerCase();
        if (p === 'brc-20') {
            // first should check if token name is matched
            if (content.tick !== this.config.token.token_name) {
                return { ret: 0, valid: false };
            }

            if (content.op === 'mint') {
                return MintOp.parse_content(content);
            } else if (content.op === 'transfer') {
                if (content.call === 'pdi-inscribe') {
                    return InscribeOp.parse_content(content);
                } else if (content.call === 'pdi-res') {
                    return ResonanceOp.parse_content(content);
                }

                return TransferOp.parse_content(content);
            } else if (content.op === 'deploy') {
                // TODO: check if deployer is matched
            } else {
                console.error(`unknown brc-20 op ${p.op} ${JSON.stringify(content)}`);
            }
        } else if (p === 'pdi') {
            if (p.op === 'inscribe') {
                return InscribeOp.parse_content(content);
            } else if (p.op === 'chant') {
                return ChantOp.parse_content(content);
            } else if (p.op === 'set') {
                return SetPriceOp.parse_content(content);
            } else if (p.op === 'res') {
                return ResonanceOp.parse_content(content);
            } else {
                console.error(`unknown pdi op ${p.op} ${JSON.stringify(content)}`);
            }
        }

        return { ret: 0, valid: false };
    }
}


class InscriptionNewItem {
    constructor(
        inscription_id,
        inscription_number,
        block_height,
        timestamp,
        address,
        satpoint,
        value,
        content,
        op,
    ) {
        assert(_.isObject(content), `content should be object`);
        assert(_.isObject(op), `op should be object`);

        this.inscription_id = inscription_id;
        this.inscription_number = inscription_number;
        this.block_height = block_height;
        this.timestamp = timestamp;
        this.address = address;
        this.satpoint = satpoint;
        this.value = value;
        this.content = content;
        this.op = op;
    }
}

class InscriptionTransferItem {
    constructor(
        inscription_id,
        inscription_number,
        block_height,
        timestamp,
        satpoint,
        from_address,
        to_address,
        value,
        index,  // index Indicates the number of transfers
    ) {
        assert(_.isString(inscription_id), `inscription_id should be string`);
        assert(
            _.isNumber(inscription_number),
            `inscription_number should be number`,
        );
        assert(
            _.isNumber(block_height),
            `block_height should be number`,
        );
        assert(_.isNumber(timestamp), `timestamp should be number`);
        assert(satpoint == null ||  _.isString(satpoint), `satpoint should be string or null`);
        assert(
            from_address == null || _.isString(from_address),
            `from_address should be string or null`,
        );
        assert(to_address == null || _.isString(to_address), `to_address should be string or null`);
        assert(_.isNumber(value), `value should be number`);
        assert(_.isNumber(index), `index should be number`);
        assert(index >= 0, `index should be >= 0: ${index}`)

        this.inscription_id = inscription_id;
        this.inscription_number = inscription_number;
        this.block_height = block_height;
        this.timestamp = timestamp;
        this.satpoint = satpoint;

        this.from_address = from_address;
        this.to_address = to_address;
        this.value = value;

        this.index = index;
    }
}

class BlockInscriptonCollector {
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
    InscriptionItem,
    TransferOp,
    MintOp,
    InscribeOp,
    ChantOp,
    SetPriceOp,
    ResonanceOp,

    InscriptionNewItem,
    InscriptionTransferItem,
    BlockInscriptonCollector,
};
