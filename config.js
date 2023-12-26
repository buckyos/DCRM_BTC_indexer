const INDEX_CONFIG = {
    // use for data dir and log dir isolate
    isolate: 'testnet',

    btc: {
        network: 'testnet',
        host: '127.0.0.1',
        auth: {
            cookie_file: 'E:\\data\\testnet\\testnet3\\.cookie',
            // cookie: username:password
            // username: "",
            // password: ""
        },
    },

    eth: {
        rpc_url: 'https://mainnet.infura.io/v3/917c4f75f17a4e28b78263cddd8f1b46',
        genesis_block_height: 100000,
        contract_address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        contract_abi: 'contract.json',
    },

    ord: {
        url: 'http://127.0.0.1:80',
    },

    db: {
        data_dir: 'E:\\data\\testnet\\testnet3',
    },

    genesis_block_height: 2543000,
    token_name: 'TTTT',
};

module.exports = INDEX_CONFIG;
