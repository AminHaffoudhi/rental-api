"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.success = success;
exports.error = error;
function success(res, data, statusCode = 200) {
    return res.status(statusCode).json({ success: true, data });
}
function error(res, message, statusCode = 400, errors) {
    return res.status(statusCode).json({ success: false, message, ...(errors !== undefined ? { errors } : {}) });
}
