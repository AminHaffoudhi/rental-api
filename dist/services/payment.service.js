"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaymentByBooking = getPaymentByBooking;
const prisma_1 = require("@/lib/prisma");
async function getPaymentByBooking(bookingId, userId) {
    const booking = await prisma_1.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || (booking.renterId !== userId && booking.ownerId !== userId)) {
        throw new Error("Booking not found");
    }
    const payment = await prisma_1.prisma.payment.findUnique({
        where: { bookingId },
        include: { booking: { include: { equipment: true } } },
    });
    if (!payment) {
        throw new Error("Payment not found");
    }
    return payment;
}
