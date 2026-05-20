"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReview = createReview;
const client_1 = require("@prisma/client");
const prisma_1 = require("@/lib/prisma");
async function createReview(reviewerId, data) {
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id: data.bookingId },
    });
    if (!booking || booking.status !== client_1.BookingStatus.COMPLETED) {
        throw new Error("Booking must be completed before reviewing");
    }
    if (booking.renterId !== reviewerId && booking.ownerId !== reviewerId) {
        throw new Error("Forbidden");
    }
    if (data.revieweeId !== booking.renterId && data.revieweeId !== booking.ownerId) {
        throw new Error("Invalid reviewee");
    }
    if (data.revieweeId === reviewerId) {
        throw new Error("Cannot review yourself");
    }
    if (booking.equipmentId !== data.equipmentId) {
        throw new Error("Equipment mismatch");
    }
    return prisma_1.prisma.review.create({
        data: {
            bookingId: data.bookingId,
            reviewerId,
            revieweeId: data.revieweeId,
            equipmentId: data.equipmentId,
            rating: data.rating,
            comment: data.comment,
        },
    });
}
