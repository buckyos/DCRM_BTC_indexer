const INDEX_VERSION = '0.5.0';

// network point multiplier factor
const ETH_NETWORK_POINT_MULTIPLIER = 8;

// point chain name
const POINT_CHAIN_ETH = 'eth';

// sqlite db file name
const SYNC_STATE_DB_FILE = 'sync_state.db';
const INDEX_STATE_DB_FILE = 'index_state.db';
const TOKEN_INDEX_DB_FILE = 'index.db';
const ETH_INDEX_DB_FILE = 'eth_index.db';
const INSCRIPTION_DB_FILE = 'inscriptions.db';
const TRANSFER_DB_FILE = 'transfer.db';

const LUCKY_MINT_MAX_AMOUNT = '1890';   // 2100 - 210 = 1890
const NORMAL_MINT_MAX_AMOUNT = '210';

// the token init amount in mint pool: 210 million.
const TOKEN_MINT_POOL_INIT_AMOUNT = '210000000';

// the token amount burned from eth network, will migrated to btc network
const TOKEN_MINT_POOL_BURN_INIT_AMOUNT = '0';

// the virtual address of mint pool and unmint pool
const TOKEN_MINT_POOL_VIRTUAL_ADDRESS = '0x0';

// the virtual address of mint pool's service charged token amount
const TOKEN_MINT_POOL_SERVICE_CHARGED_VIRTUAL_ADDRESS = '0x1';

// the virtual address of mint pool's lucky mint token amount
const TOKEN_MINT_POOL_LUCKY_MINT_VIRTUAL_ADDRESS = '0x2';

// the virtual address of mint pool's chant token amount
const TOKEN_MINT_POOL_CHANT_VIRTUAL_ADDRESS = '0x3';

// the virtual address of mint pool's burn mint token amount
const TOKEN_MINT_POOL_BURN_MINT_VIRTUAL_ADDRESS = '0x4';

// use to store the init amount of burn mint pool
const TOKEN_MINT_POOL_BURN_MINT_INIT_VIRTUAL_ADDRESS = '0x5';

// the decimal of our token
const TOKEN_DECIMAL = 18;

// difficulty of inscribe data hash
const DIFFICULTY_INSCRIBE_DATA_HASH_THRESHOLD = 32;

// difficulty of inscribe lucky mint block height
const DIFFICULTY_INSCRIBE_LUCKY_MINT_BLOCK_THRESHOLD = 8;

// difficulty of chant block height
const DIFFICULTY_CHANT_BLOCK_THRESHOLD = 8;

// the minimal size of data hash, if the data hash is less than this size, we will set to it
const DATA_HASH_START_SIZE = 1024 * 1024 * 128;

module.exports = {
    INDEX_VERSION,
    POINT_CHAIN_ETH,

    ETH_NETWORK_POINT_MULTIPLIER,

    SYNC_STATE_DB_FILE,
    INDEX_STATE_DB_FILE,
    TOKEN_INDEX_DB_FILE,
    ETH_INDEX_DB_FILE,
    INSCRIPTION_DB_FILE,
    TRANSFER_DB_FILE,

    LUCKY_MINT_MAX_AMOUNT,
    NORMAL_MINT_MAX_AMOUNT,

    TOKEN_MINT_POOL_INIT_AMOUNT,
    TOKEN_MINT_POOL_BURN_INIT_AMOUNT,
    TOKEN_MINT_POOL_VIRTUAL_ADDRESS,
    TOKEN_MINT_POOL_SERVICE_CHARGED_VIRTUAL_ADDRESS,
    TOKEN_MINT_POOL_LUCKY_MINT_VIRTUAL_ADDRESS,
    TOKEN_MINT_POOL_CHANT_VIRTUAL_ADDRESS,
    TOKEN_MINT_POOL_BURN_MINT_VIRTUAL_ADDRESS,
    TOKEN_MINT_POOL_BURN_MINT_INIT_VIRTUAL_ADDRESS,

    TOKEN_DECIMAL,

    DIFFICULTY_INSCRIBE_DATA_HASH_THRESHOLD,
    DIFFICULTY_INSCRIBE_LUCKY_MINT_BLOCK_THRESHOLD,
    DIFFICULTY_CHANT_BLOCK_THRESHOLD,

    DATA_HASH_START_SIZE,
};
