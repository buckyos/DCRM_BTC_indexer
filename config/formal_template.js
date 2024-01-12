

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
        host: '127.0.0.1',
        auth: {
            cookie_file: "/btc/.cookie",
        },
    },


    eth: {
        // rpc_url: 'https://mainnet.infura.io/v3/8ee80cc4b7c34819957fa2c6d63429e3',
        rpc_url: 'http://127.0.0.1:8545',
        genesis_block_height: 18816888,
        contract_address: '0x30EeEF94C7cfb7CC2b3BF8F6a2376ec187A95E8d',
        contract_abi: 'contract.json',

        lucky_mint_contract_address: '0x56fEc5fe1c73808762167e1f3815F76B2B358160',
        lucky_mint_contract_abi: 'lucky_mint_contract.json',
    },

    ord: {
        rpc_url: 'http://127.0.0.1:8070',
    },

    db: {
        data_dir,
    },

    service: {
        port: 13040,
        log_level: 'info',
    },

    token: {
        account: {
            foundation_address: 'bc1pfjhvf3h7ewq5v3r97qqjku87qtrqqcas599cj4pmts4n6fnakzhqu7vwm3',
        },

        genesis_block_height: 821884,
        token_name: 'dmcs',
        //genesis_block_height: 779832,
        //token_name: 'ordi',
    },

    interface: {
        port: 13001,
    },

    monitor: {
        // notify_url: '',
    }
};

module.exports = INDEX_CONFIG;