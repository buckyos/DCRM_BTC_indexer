let data_dir;
if (process.platform === 'win32') {
    data_dir = 'C:\\dcrm\\data';
} else {
    data_dir = '/opt/dcrm/data';
}

const INDEX_CONFIG = {
    // use for data dir and log dir isolate
    isolate: 'testnet',

    btc: {
        network: 'testnet',
        host: '127.0.0.1',
        auth: {
            cookie_file: '/btc/testnet/testnet3/.cookie',
            // cookie: username:password
            // username: "",
            // password: ""
        },
    },

    eth: {
        rpc_url: 'http://127.0.0.1:8547',
        genesis_block_height: 1,
        contract_address: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
        contract_abi: 'contract.json',
    },

    ord: {
        rpc_url: 'http://127.0.0.1:8071',
    },

    db: {
        data_dir,
    },

    service: {
        port: 8081,
    },

    token: {
        account: {
            foundation_address: '0x100',
        },

        genesis_block_height: 2570577,
        token_name: 'dmcs',

        // difficulty for token ops
        difficulty : {
            lucky_mint_block_threshold: 4,
            inscribe_data_hash_threshold: 1,
            chant_block_threshold: 1,
        }
    },
};

module.exports = INDEX_CONFIG;
