"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const apiResponse_1 = require("@/utils/apiResponse");
function validate(schema) {
    return (req, res, next) => {
        const parsed = schema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return void (0, apiResponse_1.error)(res, "Validation failed", 400, parsed.error.flatten());
        }
        req.body = parsed.data;
        next();
    };
}
