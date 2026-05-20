"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchEquipment = searchEquipment;
exports.getEquipmentById = getEquipmentById;
exports.createEquipment = createEquipment;
exports.updateEquipment = updateEquipment;
exports.deleteEquipment = deleteEquipment;
exports.getAvailability = getAvailability;
const client_1 = require("@prisma/client");
const prisma_1 = require("@/lib/prisma");
const httpError_1 = require("@/utils/httpError");
async function searchEquipment(filters) {
    const where = {
        isAvailable: true,
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.location
            ? { location: { contains: filters.location, mode: "insensitive" } }
            : {}),
        ...(filters.minPrice !== undefined || filters.maxPrice !== undefined
            ? {
                dailyRate: {
                    ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
                    ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
                },
            }
            : {}),
        ...(filters.q
            ? {
                OR: [
                    { title: { contains: filters.q, mode: "insensitive" } },
                    { description: { contains: filters.q, mode: "insensitive" } },
                ],
            }
            : {}),
    };
    return prisma_1.prisma.equipment.findMany({
        where,
        include: {
            owner: {
                select: { id: true, name: true, image: true, role: true },
            },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
    });
}
async function getEquipmentById(id) {
    const row = await prisma_1.prisma.equipment.findUnique({
        where: { id },
        include: {
            owner: {
                select: {
                    id: true,
                    name: true,
                    image: true,
                    role: true,
                    createdAt: true,
                },
            },
            reviews: {
                include: {
                    reviewer: { select: { id: true, name: true, image: true } },
                },
                orderBy: { createdAt: "desc" },
            },
        },
    });
    if (!row) {
        throw new httpError_1.HttpError(404, "Equipment not found");
    }
    return row;
}
async function createEquipment(ownerId, data) {
    return prisma_1.prisma.equipment.create({
        data: {
            title: data.title,
            description: data.description,
            category: data.category,
            dailyRate: data.dailyRate,
            weeklyRate: data.weeklyRate,
            depositAmount: data.depositAmount,
            deliveryFee: data.deliveryFee,
            location: data.location,
            images: data.images ?? [],
            ownerId,
        },
    });
}
async function updateEquipment(id, ownerId, data) {
    const existing = await prisma_1.prisma.equipment.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== ownerId) {
        throw new Error("Equipment not found");
    }
    return prisma_1.prisma.equipment.update({
        where: { id },
        data,
    });
}
async function deleteEquipment(id, ownerId) {
    const existing = await prisma_1.prisma.equipment.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== ownerId) {
        throw new Error("Equipment not found");
    }
    await prisma_1.prisma.equipment.delete({ where: { id } });
}
async function getAvailability(equipmentId, month) {
    const start = new Date(`${month}-01T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) {
        throw new Error("Invalid month format. Use YYYY-MM.");
    }
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    const bookings = await prisma_1.prisma.booking.findMany({
        where: {
            equipmentId,
            status: {
                notIn: [client_1.BookingStatus.REJECTED, client_1.BookingStatus.CANCELLED, client_1.BookingStatus.REFUNDED],
            },
            AND: [{ startDate: { lte: end } }, { endDate: { gte: start } }],
        },
        select: {
            id: true,
            startDate: true,
            endDate: true,
            status: true,
        },
        orderBy: { startDate: "asc" },
    });
    return { month, ranges: bookings };
}
