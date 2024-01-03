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
            cookie_file: '/btc/.cookie',
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
        rpc_url: 'http://127.0.0.1:80',
    },

    db: {
        data_dir,
    },

    service: {
        port: 13020,
    },

    token: {
        account: {
            mint_pool_address: '0x0',
            foundation_address: '0x0',
        },

        genesis_block_height: 2543000,
        token_name: 'TTTT',
    },
};

module.exports = INDEX_CONFIG;
