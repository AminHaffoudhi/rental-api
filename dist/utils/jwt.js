"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.verifyToken = verifyToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("@/config/env");
function signToken(payload) {
    return jsonwebtoken_1.default.sign(payload, env_1.JWT_SECRET, {
        expiresIn: env_1.JWT_EXPIRES_IN,
    });
}
function verifyToken(token) {
    const decoded = jsonwebtoken_1.default.verify(token, env_1.JWT_SECRET);
    if (typeof decoded === "string" || !decoded || typeof decoded !== "object") {
        throw new Error("Invalid token payload");
    }
    const { id, role, email } = decoded;
    if (typeof id !== "string" || typeof role !== "string" || typeof email !== "string") {
        throw new Error("Invalid token payload shape");
    }
    return { id, role, email };
}
