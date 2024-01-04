

// data dir is /opt/dcrm on *nix and C:\\dcrm on windows
let data_dir;
if (process.platform === 'win32') {
    data_dir = 'C:\\dcrm\\data';
} else {
    data_dir = '/opt/dcrm/data';
}

const INDEX_CONFIG = {
    // use for data dir and log dir isolate
    isolate: 'formal',

    btc: {
        network: 'mainnet',
        // host: '75.4.200.194',
        host: '127.0.0.1',
        auth: {
            cookie: "dcrm_test:dcrm_test_123456",
        },
    },

    
    eth: {
        // rpc_url: 'https://mainnet.infura.io/v3/8ee80cc4b7c34819957fa2c6d63429e3',
        rpc_url: 'http://127.0.0.1:8545',
        genesis_block_height: 16757234,
        contract_address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        contract_abi: 'contract.json',
    },

    ord: {
        // rpc_url: 'http://75.4.200.194:8081',
        rpc_url: 'http://127.0.0.1:8081',
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

        genesis_block_height: 779832,
        token_name: 'ordi',
    }
};

module.exports = INDEX_CONFIG;