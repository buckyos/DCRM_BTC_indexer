const assert = require('assert');
const { default: axios } = require('axios');


class OkLinkService {
    constructor(config) {
        assert(_.isObject(config), `invalid config: ${config}`);
        this.api = 'https://www.oklink.com';
        this.api_key = config.oklink.api_key;
        assert(_.isString(this.api_key), `invalid oklink api_key: ${this.api_key}`);

        this.client = axios.create({
            baseURL: this.api,
            headers: {
                'Ok-Access-Key': this.api_key,
            },
        });
    }

    /**
     * 
     * @param {string} inscription_id 
     * @returns {Promise<{ret: number, info: object}>}
     * {
            inscriptionId: '17352fd494b0cd70f0a835575178bdbaeca789fa2fd49c4c552bc9abfdb96b5bi0',
            inscriptionNumber: '384419',
            location: '17352fd494b0cd70f0a835575178bdbaeca789fa2fd49c4c552bc9abfdb96b5b:0:0',
            token: 'ordi',
            state: 'success',
            msg: 'amt has been cut off to fit the supply! origin: 1000000000000000000000, now: 422000000000000000000',
            tokenType: 'BRC20',
            actionType: 'mint',
            logoUrl: '',
            ownerAddress: 'bc1pkc2ylzs5p90exeunjsplpefyehafm9sfs47jszgcalphd05qxn7qnght5j',
            txId: '17352fd494b0cd70f0a835575178bdbaeca789fa2fd49c4c552bc9abfdb96b5b',
            blockHeight: '780070',
            contentSize: '',
            time: '1678404195000'
        }
     */
    async get_inscription_detail(inscription_id) {
        assert(_.isString(inscription_id), `invalid inscription_id: ${inscription_id}`);

        return new Promise((resolve) => {
            this.client.get(`/api/v5/explorer/btc/inscriptions-list?inscriptionId=${inscription_id}`)
                .then((response) => {
                    const info = response.data.data[0].inscriptionsList[0];
                    assert(info.inscriptionId === inscription_id);
                    resolve({ret: 0, info});
                })
                .catch((error) => {
                    console.error(`failed to get inscription detail: ${error}`);
                    resolve({
                        ret: -1,
                    });
                });
        });
    }
}

module.exports = { OkLinkService };

/*
async function test() {
    const service = new OkLinkService();
    const {ret, info} = await service.get_inscription_detail('17352fd494b0cd70f0a835575178bdbaeca789fa2fd49c4c552bc9abfdb96b5bi0');
    console.log(ret, info);
}

global._ = require('underscore');
test();
*/