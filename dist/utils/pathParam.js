"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pathParam = pathParam;
const httpError_1 = require("@/utils/httpError");
function pathParam(value) {
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw !== "string" || raw.length === 0) {
        throw new httpError_1.HttpError(400, "Invalid path parameter");
    }
    return raw;
}
