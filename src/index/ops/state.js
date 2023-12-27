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
};


module.exports = { InscriptionOpState };