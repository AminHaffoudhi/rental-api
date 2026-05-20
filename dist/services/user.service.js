"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserById = getUserById;
exports.updateUser = updateUser;
exports.uploadKyc = uploadKyc;
const prisma_1 = require("@/lib/prisma");
const httpError_1 = require("@/utils/httpError");
function toSafeUser(user) {
    const { password: _p, ...rest } = user;
    return rest;
}
async function getUserById(id) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            createdAt: true,
            equipment: {
                where: { isAvailable: true },
                orderBy: { createdAt: "desc" },
                take: 12,
            },
            reviewsReceived: {
                include: {
                    reviewer: { select: { id: true, name: true, image: true } },
                    equipment: { select: { id: true, title: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 20,
            },
        },
    });
    if (!user) {
        throw new httpError_1.HttpError(404, "User not found");
    }
    return user;
}
async function updateUser(id, data) {
    const user = await prisma_1.prisma.user.update({
        where: { id },
        data,
    });
    return toSafeUser(user);
}
async function uploadKyc(id, documentUrl) {
    const user = await prisma_1.prisma.user.update({
        where: { id },
        data: {
            kycDocumentUrl: documentUrl,
            kycStatus: "SUBMITTED",
        },
    });
    return toSafeUser(user);
}
