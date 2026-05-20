"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
const apiResponse_1 = require("@/utils/apiResponse");
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return void (0, apiResponse_1.error)(res, "Unauthorized", 401);
        }
        if (!roles.includes(req.user.role)) {
            return void (0, apiResponse_1.error)(res, "Forbidden", 403);
        }
        next();
    };
}
