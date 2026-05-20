"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoCompleteBookings = autoCompleteBookings;
const client_1 = require("@prisma/client");
const prisma_1 = require("@/lib/prisma");
const HOURS_48_MS = 48 * 60 * 60 * 1000;
async function autoCompleteBookings() {
    const cutoff = new Date(Date.now() - HOURS_48_MS);
    const stale = await prisma_1.prisma.booking.findMany({
        where: {
            status: client_1.BookingStatus.INSPECTING,
            updatedAt: { lt: cutoff },
        },
        select: { id: true },
    });
    for (const row of stale) {
        await prisma_1.prisma.booking.update({
            where: { id: row.id },
            data: { status: client_1.BookingStatus.COMPLETED },
        });
    }
}
