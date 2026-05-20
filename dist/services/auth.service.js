"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.getMe = getMe;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("@/lib/prisma");
const httpError_1 = require("@/utils/httpError");
const jwt_1 = require("@/utils/jwt");
function toSafeUser(user) {
    const { password: _p, ...rest } = user;
    return rest;
}
async function register(data) {
    const hashed = await bcryptjs_1.default.hash(data.password, 12);
    const user = await prisma_1.prisma.user.create({
        data: {
            name: data.name,
            email: data.email.toLowerCase(),
            password: hashed,
            phone: data.phone,
        },
    });
    const token = (0, jwt_1.signToken)({
        id: user.id,
        role: user.role,
        email: user.email,
    });
    return { user: toSafeUser(user), token };
}
async function login(email, password) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
    });
    if (!user?.password) {
        throw new httpError_1.HttpError(401, "Invalid credentials");
    }
    const ok = await bcryptjs_1.default.compare(password, user.password);
    if (!ok) {
        throw new httpError_1.HttpError(401, "Invalid credentials");
    }
    const token = (0, jwt_1.signToken)({
        id: user.id,
        role: user.role,
        email: user.email,
    });
    return { user: toSafeUser(user), token };
}
async function getMe(userId) {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new httpError_1.HttpError(404, "User not found");
    }
    return toSafeUser(user);
}
