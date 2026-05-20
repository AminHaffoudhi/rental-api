"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDelivery = getDelivery;
exports.uploadPickupPhotos = uploadPickupPhotos;
exports.uploadReturnPhotos = uploadReturnPhotos;
const client_1 = require("@prisma/client");
const prisma_1 = require("@/lib/prisma");
async function assertBookingParticipant(bookingId, userId) {
    const booking = await prisma_1.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || (booking.renterId !== userId && booking.ownerId !== userId)) {
        throw new Error("Forbidden");
    }
}
async function getDelivery(deliveryId, userId) {
    const delivery = await prisma_1.prisma.delivery.findUnique({
        where: { id: deliveryId },
        include: { booking: true },
    });
    if (!delivery) {
        throw new Error("Delivery not found");
    }
    await assertBookingParticipant(delivery.bookingId, userId);
    return delivery;
}
async function uploadPickupPhotos(deliveryId, photos, userId) {
    const delivery = await prisma_1.prisma.delivery.findUnique({
        where: { id: deliveryId },
        include: { booking: true },
    });
    if (!delivery) {
        throw new Error("Delivery not found");
    }
    await assertBookingParticipant(delivery.bookingId, userId);
    return prisma_1.prisma.delivery.update({
        where: { id: deliveryId },
        data: {
            pickupPhotos: [...delivery.pickupPhotos, ...photos],
            status: client_1.DeliveryStatus.PICKED_UP,
        },
    });
}
async function uploadReturnPhotos(deliveryId, photos, userId) {
    const delivery = await prisma_1.prisma.delivery.findUnique({
        where: { id: deliveryId },
        include: { booking: true },
    });
    if (!delivery) {
        throw new Error("Delivery not found");
    }
    await assertBookingParticipant(delivery.bookingId, userId);
    return prisma_1.prisma.delivery.update({
        where: { id: deliveryId },
        data: {
            returnPhotos: [...delivery.returnPhotos, ...photos],
            status: client_1.DeliveryStatus.RETURN_PICKED_UP,
        },
    });
}
