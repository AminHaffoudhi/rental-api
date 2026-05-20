"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendReturnReminders = sendReturnReminders;
const client_1 = require("@prisma/client");
const prisma_1 = require("@/lib/prisma");
const email_service_1 = require("@/services/email.service");
const dates_1 = require("@/utils/dates");
async function sendReturnReminders() {
    const tomorrowStart = (0, dates_1.startOfDay)((0, dates_1.addDays)(new Date(), 1));
    const tomorrowEnd = (0, dates_1.endOfDay)((0, dates_1.addDays)(new Date(), 1));
    const bookings = await prisma_1.prisma.booking.findMany({
        where: {
            status: client_1.BookingStatus.ACTIVE,
            endDate: {
                gte: tomorrowStart,
                lte: tomorrowEnd,
            },
        },
        include: {
            renter: true,
        },
    });
    for (const booking of bookings) {
        await (0, email_service_1.sendReturnReminderEmail)(booking.renter, booking);
    }
}
