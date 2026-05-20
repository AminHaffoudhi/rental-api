"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePrice = calculatePrice;
exports.isAvailable = isAvailable;
exports.createBooking = createBooking;
exports.getMyBookings = getMyBookings;
exports.getBookingById = getBookingById;
exports.canTransition = canTransition;
exports.transitionBooking = transitionBooking;
exports.approveBooking = approveBooking;
exports.rejectBooking = rejectBooking;
exports.cancelBooking = cancelBooking;
exports.confirmDelivery = confirmDelivery;
exports.requestReturn = requestReturn;
exports.raiseDispute = raiseDispute;
const client_1 = require("@prisma/client");
const bookingStates_1 = require("@/config/bookingStates");
const constants_1 = require("@/config/constants");
const prisma_1 = require("@/lib/prisma");
const email_service_1 = require("@/services/email.service");
const dates_1 = require("@/utils/dates");
const occupiedFilter = {
    notIn: [client_1.BookingStatus.REJECTED, client_1.BookingStatus.CANCELLED, client_1.BookingStatus.REFUNDED],
};
function calculatePrice(equipment, startDate, endDate) {
    const days = (0, dates_1.getDaysBetween)(startDate, endDate);
    if (days < constants_1.MIN_RENTAL_DAYS || days > constants_1.MAX_RENTAL_DAYS) {
        throw new Error(`Rental must be between ${constants_1.MIN_RENTAL_DAYS} and ${constants_1.MAX_RENTAL_DAYS} days`);
    }
    let rentTotal = equipment.dailyRate * days;
    if (equipment.weeklyRate !== null && equipment.weeklyRate !== undefined && days >= 7) {
        const weeklyChunks = Math.floor(days / 7);
        const remainder = days % 7;
        const weeklyCost = weeklyChunks * equipment.weeklyRate + remainder * equipment.dailyRate;
        rentTotal = Math.min(rentTotal, weeklyCost);
    }
    const platformFee = (rentTotal * constants_1.PLATFORM_FEE_PERCENT) / 100;
    const deliveryFee = equipment.deliveryFee;
    const depositAmount = equipment.depositAmount;
    const rentalTotal = rentTotal + platformFee + deliveryFee;
    const grandTotal = rentalTotal + depositAmount;
    return { rentTotal, platformFee, deliveryFee, depositAmount, rentalTotal, grandTotal };
}
async function isAvailable(equipmentId, startDateInclusive, endDateInclusive) {
    const rangeStart = (0, dates_1.startOfDay)(startDateInclusive);
    const rangeEndExclusive = (0, dates_1.addDays)((0, dates_1.startOfDay)(endDateInclusive), 1);
    const overlapping = await prisma_1.prisma.booking.count({
        where: {
            equipmentId,
            status: occupiedFilter,
            AND: [{ startDate: { lt: rangeEndExclusive } }, { endDate: { gt: rangeStart } }],
        },
    });
    return overlapping === 0;
}
async function createBooking(renterId, data) {
    const equipment = await prisma_1.prisma.equipment.findUnique({ where: { id: data.equipmentId } });
    if (!equipment || !equipment.isAvailable) {
        throw new Error("Equipment not available");
    }
    if (equipment.ownerId === renterId) {
        throw new Error("You cannot book your own equipment");
    }
    const start = (0, dates_1.startOfDay)(data.startDate);
    const end = (0, dates_1.startOfDay)(data.endDate);
    if (end.getTime() < start.getTime()) {
        throw new Error("End date must be on or after start date");
    }
    const available = await isAvailable(data.equipmentId, start, end);
    if (!available) {
        throw new Error("Equipment is not available for these dates");
    }
    const pricing = calculatePrice(equipment, start, end);
    const bookingEnd = (0, dates_1.endOfDay)(end);
    const booking = await prisma_1.prisma.booking.create({
        data: {
            renterId,
            ownerId: equipment.ownerId,
            equipmentId: equipment.id,
            status: client_1.BookingStatus.PENDING,
            startDate: start,
            endDate: bookingEnd,
            totalPrice: pricing.rentalTotal,
            depositAmount: pricing.depositAmount,
            deliveryFee: pricing.deliveryFee,
            platformFee: pricing.platformFee,
            notes: data.notes,
            payment: {
                create: {
                    amount: pricing.rentalTotal,
                    depositAmount: pricing.depositAmount,
                    status: client_1.PaymentStatus.PENDING,
                },
            },
            delivery: {
                create: {
                    status: client_1.DeliveryStatus.SCHEDULED,
                    pickupPhotos: [],
                    returnPhotos: [],
                },
            },
        },
        include: {
            equipment: true,
            renter: true,
            owner: true,
        },
    });
    await (0, email_service_1.sendBookingRequestEmail)(booking.owner, booking.renter, booking.equipment, booking);
    return booking;
}
async function getMyBookings(userId) {
    const asRenter = await prisma_1.prisma.booking.findMany({
        where: { renterId: userId },
        include: {
            equipment: true,
            owner: { select: { id: true, name: true, image: true, email: true } },
            renter: { select: { id: true, name: true, image: true, email: true } },
            delivery: true,
            payment: true,
        },
        orderBy: { createdAt: "desc" },
    });
    const asOwner = await prisma_1.prisma.booking.findMany({
        where: { ownerId: userId },
        include: {
            equipment: true,
            owner: { select: { id: true, name: true, image: true, email: true } },
            renter: { select: { id: true, name: true, image: true, email: true } },
            delivery: true,
            payment: true,
        },
        orderBy: { createdAt: "desc" },
    });
    return { asRenter, asOwner };
}
async function getBookingById(id, userId) {
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id },
        include: {
            equipment: true,
            owner: true,
            renter: true,
            delivery: true,
            payment: true,
            dispute: true,
        },
    });
    if (!booking || (booking.renterId !== userId && booking.ownerId !== userId)) {
        throw new Error("Booking not found");
    }
    return booking;
}
function canTransition(current, next) {
    return bookingStates_1.BookingStateConfig[current].allowedTransitions.includes(next);
}
async function transitionBooking(bookingId, nextStatus, userId) {
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            equipment: true,
            owner: true,
            renter: true,
            delivery: true,
            payment: true,
        },
    });
    if (!booking) {
        throw new Error("Booking not found");
    }
    if (booking.renterId !== userId && booking.ownerId !== userId) {
        throw new Error("Forbidden");
    }
    if (!canTransition(booking.status, nextStatus)) {
        throw new Error(`Cannot transition from ${booking.status} to ${nextStatus}`);
    }
    const updated = await prisma_1.prisma.booking.update({
        where: { id: bookingId },
        data: { status: nextStatus },
        include: {
            equipment: true,
            owner: true,
            renter: true,
            delivery: true,
            payment: true,
        },
    });
    if (nextStatus === client_1.BookingStatus.CONFIRMED) {
        await (0, email_service_1.sendBookingConfirmedEmail)(updated.renter, updated.equipment, updated);
    }
    if (nextStatus === client_1.BookingStatus.REJECTED) {
        await (0, email_service_1.sendBookingRejectedEmail)(updated.renter, updated.equipment);
    }
    if (nextStatus === client_1.BookingStatus.PICKUP_SCHEDULED && updated.delivery) {
        await (0, email_service_1.sendDeliveryScheduledEmail)(updated.renter, updated.delivery, updated);
    }
    return updated;
}
async function approveBooking(bookingId, ownerId) {
    const booking = await prisma_1.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.ownerId !== ownerId) {
        throw new Error("Booking not found");
    }
    if (booking.status !== client_1.BookingStatus.PENDING) {
        throw new Error("Booking is not pending approval");
    }
    let current = await prisma_1.prisma.booking.update({
        where: { id: bookingId },
        data: { status: client_1.BookingStatus.CONFIRMED },
        include: {
            equipment: true,
            owner: true,
            renter: true,
            delivery: true,
            payment: true,
        },
    });
    await (0, email_service_1.sendBookingConfirmedEmail)(current.renter, current.equipment, current);
    current = await prisma_1.prisma.booking.update({
        where: { id: bookingId },
        data: { status: client_1.BookingStatus.PAYMENT_PENDING },
        include: {
            equipment: true,
            owner: true,
            renter: true,
            delivery: true,
            payment: true,
        },
    });
    return current;
}
async function rejectBooking(bookingId, ownerId, reason) {
    const booking = await prisma_1.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.ownerId !== ownerId) {
        throw new Error("Booking not found");
    }
    if (!canTransition(booking.status, client_1.BookingStatus.REJECTED)) {
        throw new Error("Cannot reject booking in current status");
    }
    const notes = reason !== undefined && reason !== ""
        ? `${booking.notes ?? ""}\nRejection reason: ${reason}`.trim()
        : booking.notes;
    const updated = await prisma_1.prisma.booking.update({
        where: { id: bookingId },
        data: { status: client_1.BookingStatus.REJECTED, ...(notes !== undefined ? { notes } : {}) },
        include: {
            equipment: true,
            owner: true,
            renter: true,
            delivery: true,
            payment: true,
        },
    });
    await (0, email_service_1.sendBookingRejectedEmail)(updated.renter, updated.equipment);
    return updated;
}
async function cancelBooking(bookingId, renterId) {
    const booking = await prisma_1.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.renterId !== renterId) {
        throw new Error("Booking not found");
    }
    if (!canTransition(booking.status, client_1.BookingStatus.CANCELLED)) {
        throw new Error("Booking cannot be cancelled now");
    }
    return prisma_1.prisma.booking.update({
        where: { id: bookingId },
        data: { status: client_1.BookingStatus.CANCELLED },
    });
}
async function confirmDelivery(bookingId, renterId) {
    const booking = await prisma_1.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.renterId !== renterId) {
        throw new Error("Booking not found");
    }
    return transitionBooking(bookingId, client_1.BookingStatus.ACTIVE, renterId);
}
async function requestReturn(bookingId, renterId) {
    const booking = await prisma_1.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.renterId !== renterId) {
        throw new Error("Booking not found");
    }
    return transitionBooking(bookingId, client_1.BookingStatus.RETURN_SCHEDULED, renterId);
}
async function raiseDispute(bookingId, userId, reason, evidence) {
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id: bookingId },
        include: { owner: true, renter: true },
    });
    if (!booking || (booking.renterId !== userId && booking.ownerId !== userId)) {
        throw new Error("Booking not found");
    }
    if (!canTransition(booking.status, client_1.BookingStatus.DISPUTED)) {
        throw new Error("Cannot open a dispute for this booking state");
    }
    await prisma_1.prisma.dispute.create({
        data: {
            bookingId,
            raisedById: userId,
            reason,
            evidence,
            status: client_1.DisputeStatus.OPEN,
        },
    });
    const updated = await prisma_1.prisma.booking.update({
        where: { id: bookingId },
        data: { status: client_1.BookingStatus.DISPUTED },
        include: {
            equipment: true,
            owner: true,
            renter: true,
        },
    });
    await (0, email_service_1.sendDisputeOpenedEmail)(updated.owner, updated.renter, updated);
    return updated;
}
