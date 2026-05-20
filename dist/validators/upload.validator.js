"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadSignatureSchema = void 0;
const zod_1 = require("zod");
exports.uploadSignatureSchema = zod_1.z.object({
    folder: zod_1.z.string().optional(),
});
