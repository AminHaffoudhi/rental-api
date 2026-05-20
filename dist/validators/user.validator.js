"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadKycSchema = exports.updateUserSchema = void 0;
const zod_1 = require("zod");
exports.updateUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    phone: zod_1.z.string().optional(),
    image: zod_1.z.string().url().optional(),
});
exports.uploadKycSchema = zod_1.z.object({
    documentUrl: zod_1.z.string().url(),
});
