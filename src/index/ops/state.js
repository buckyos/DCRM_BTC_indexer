
// inscription op's state
const InscriptionOpState = {
    OK: 0,

    ALREADY_EXISTS: 1,

    HASH_UNMATCH: 2,

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


module.exports = { InscriptionOpState };