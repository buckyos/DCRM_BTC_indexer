
// inscription op's state
const InscriptionOpState = {
    OK: 0,

    ALREADY_EXISTS: 1,

    HASH_UNMATCH: 2,

    // competition failed in same block
    COMPETITION_FAILED: 3,

    // amt is less than hash weight
    INVALID_AMT: 4,

    // balance not enough
    INSUFFICIENT_BALANCE: 5,

    // hash not found
    HASH_NOT_FOUND: 6,

    PERMISSION_DENIED: 7,
};


module.exports = { InscriptionOpState };