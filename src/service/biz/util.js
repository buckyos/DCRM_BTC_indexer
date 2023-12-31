const ERR_CODE = {
    SUCCESS: 0,
    INVALID_PARAM: 1,
    NOT_FOUND: 2,
    DB_ERROR: 3,
    NOT_IMPLEMENTED: 4,
    UNKNOWN_ERROR: 5,
}

function makeReponse(err, msg, result) {
    if (err != ERR_CODE.SUCCESS && !msg) {
        switch (err) {
            case ERR_CODE.INVALID_PARAM:
                msg = "invalid param";
                break;
            case ERR_CODE.DB_ERROR:
                msg = "db error";
                break;
            case ERR_CODE.NOT_FOUND:
                msg = "not found";
                break;
            case ERR_CODE.NOT_IMPLEMENTED:
                msg = "not implemented";
                break;
            default:
                msg = "unknown error";
                break;
        }
    }
    return {
        err,
        msg,
        result,
    };
}

function makeSuccessReponse(result) {
    return makeReponse(ERR_CODE.SUCCESS, null, result);
}

module.exports = {
    makeReponse,
    makeSuccessReponse,
    ERR_CODE,
}