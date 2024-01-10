const ERR_CODE = {
    SUCCESS: 0,
    INVALID_PARAM: 1,
    NOT_FOUND: 2,
    DB_ERROR: 3,
    NOT_IMPLEMENTED: 4,
    UNKNOWN_ERROR: 5,
}

function makeResponse(err, msg, result) {
    if (err != ERR_CODE.SUCCESS && !msg) {
        switch (err) {
            case ERR_CODE.INVALID_PARAM:
                msg = "Invalid param";
                break;
            case ERR_CODE.DB_ERROR:
                msg = "DB error";
                break;
            case ERR_CODE.NOT_FOUND:
                msg = "Not found";
                break;
            case ERR_CODE.NOT_IMPLEMENTED:
                msg = "Not implemented";
                break;
            default:
                msg = "Internal server error";
                break;
        }
    }
    return {
        err,
        msg,
        result,
    };
}

function makeSuccessResponse(result) {
    return makeResponse(ERR_CODE.SUCCESS, null, result);
}

module.exports = {
    makeResponse,
    makeSuccessResponse,
    ERR_CODE,
}