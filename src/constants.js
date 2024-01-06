// sqlite db file name
const STATE_DB_FILE = 'state.db';
const TOKEN_STATE_DB_FILE = 'token_state.db';
const TOKEN_INDEX_DB_FILE = 'index.db';
const ETH_INDEX_DB_FILE = 'eth_index.db';
const INSCRIPTION_DB_FILE = 'inscriptions.db';
const TRANSFER_DB_FILE = 'transfer.db';


const LUCKY_MINT_MAX_AMOUNT = '2100';
const NORMAL_MINT_MAX_AMOUNT = '210';

// the token init amount in mint pool: 210 million.
const TOKEN_MINT_POOL_INIT_AMOUNT = '210000000'; 

// the token amount burned from eth network, will migrated to btc network
const TOKEN_MINT_POOL_BURN_INIT_AMOUNT = '40000000';

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

// the decimal of our token
const TOKEN_DECIMAL = 18;


// difficulty of inscribe data hash
const DIFFICULTY_INSCRIBE_DATA_HASH_THRESHOLD = 32;

// difficulty of inscribe lucky mint block height
const DIFFICULTY_INSCRIBE_LUCKY_MINT_BLOCK_THRESHOLD = 64;

// difficulty of chant block height
const DIFFICULTY_CHANT_BLOCK_THRESHOLD = 64;

module.exports = {
    STATE_DB_FILE,
    TOKEN_STATE_DB_FILE,
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

    TOKEN_DECIMAL,
    
    DIFFICULTY_INSCRIBE_DATA_HASH_THRESHOLD,
    DIFFICULTY_INSCRIBE_LUCKY_MINT_BLOCK_THRESHOLD,
    DIFFICULTY_CHANT_BLOCK_THRESHOLD,
};
