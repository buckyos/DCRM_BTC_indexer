// the state of inscription on btc chain
const InscriptionStage = {
    Inscribe: 'inscribe', // commit and reveal on chain
    Transfer: 'transfer', // transfer on chain
};

// inscription op's state
const InscriptionOpState = {
    OK: 0,

    ALREADY_EXISTS: 1,

    HASH_UNMATCHED: 2,

    // competition failed in same block
    COMPETITION_FAILED: 3,

    // amt is invalid
    INVALID_AMT: 4,

    // balance not enough
    INSUFFICIENT_BALANCE: 5,

    // hash not found
    HASH_NOT_FOUND: 6,

    // permission denied
    PERMISSION_DENIED: 7,

    // invalid params
    INVALID_PARAMS: 8,

    // invalid price
    INVALID_PRICE: 9,

    OUT_OF_RESONANCE_LIMIT: 10,

    HAS_NO_VALID_CHANT: 11,

    OUT_ADDRESS_IS_NOT_OWNER: 12,
};


const MintType = {
    NormalMint: 0,
    LuckyMint: 1,
    BurnMint: 2,
};

module.exports = { InscriptionOpState, InscriptionStage, MintType };
