"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const prisma_1 = require("@/lib/prisma");
const apiResponse_1 = require("@/utils/apiResponse");
const jwt_1 = require("@/utils/jwt");
async function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return void (0, apiResponse_1.error)(res, "Unauthorized", 401);
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) {
        return void (0, apiResponse_1.error)(res, "Unauthorized", 401);
    }
    try {
        const payload = (0, jwt_1.verifyToken)(token);
        const user = await prisma_1.prisma.user.findUnique({ where: { id: payload.id } });
        if (!user) {
            return void (0, apiResponse_1.error)(res, "Unauthorized", 401);
        }
        req.user = { id: user.id, role: user.role, email: user.email };
        next();
    }
    catch {
        return void (0, apiResponse_1.error)(res, "Unauthorized", 401);
    }
}
