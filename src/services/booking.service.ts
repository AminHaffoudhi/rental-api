import {
  BookingStatus,
  DeliveryStatus,
  DisputeStatus,
  PaymentStatus,
  Prisma,
  type Booking,
  type Equipment,
} from "@prisma/client";
import { BookingStateConfig } from "@/config/bookingStates";
import { MAX_RENTAL_DAYS, MIN_RENTAL_DAYS, PLATFORM_FEE_PERCENT } from "@/config/constants";
import {
  BusinessError,
  ConflictError,
  ForbiddenError,
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  logNonCriticalEmailFailure,
  sendBookingConfirmedEmail,
  sendBookingRejectedEmail,
  sendBookingRequestEmail,
  sendDeliveryScheduledEmail,
  sendDisputeOpenedEmail,
} from "@/services/email.service";
import {
  notifyBookingApproved,
  notifyBookingRejected,
  notifyBookingRequest,
  notifyDeliveryScheduled,
  notifyDisputeOpened,
  notifyPaymentConfirmed,
} from "@/services/notification.service";
import { addDays, endOfDay, getDaysBetween, startOfDay } from "@/utils/dates";

const occupiedFilter: Prisma.EnumBookingStatusFilter = {
  notIn: [BookingStatus.REJECTED, BookingStatus.CANCELLED, BookingStatus.REFUNDED],
};

export function calculatePrice(equipment: Equipment, startDate: Date, endDate: Date) {
  const days = getDaysBetween(startDate, endDate);
  if (days < MIN_RENTAL_DAYS || days > MAX_RENTAL_DAYS) {
    throw new ValidationError(`Rental must be between ${MIN_RENTAL_DAYS} and ${MAX_RENTAL_DAYS} days`);
  }

  let rentTotal = equipment.dailyRate * days;
  if (equipment.weeklyRate !== null && equipment.weeklyRate !== undefined && days >= 7) {
    const weeklyChunks = Math.floor(days / 7);
    const remainder = days % 7;
    const weeklyCost = weeklyChunks * equipment.weeklyRate + remainder * equipment.dailyRate;
    rentTotal = Math.min(rentTotal, weeklyCost);
  }

  const platformFee = (rentTotal * PLATFORM_FEE_PERCENT) / 100;
  const deliveryFee = equipment.deliveryFee;
  const depositAmount = equipment.depositAmount;
  const rentalTotal = rentTotal + platformFee + deliveryFee;
  const grandTotal = rentalTotal + depositAmount;

  return { rentTotal, platformFee, deliveryFee, depositAmount, rentalTotal, grandTotal };
}

export async function isAvailable(
  equipmentId: string,
  startDateInclusive: Date,
  endDateInclusive: Date
): Promise<boolean> {
  const rangeStart = startOfDay(startDateInclusive);
  const rangeEndExclusive = addDays(startOfDay(endDateInclusive), 1);
  const overlapping = await prisma.booking.count({
    where: {
      equipmentId,
      status: occupiedFilter,
      AND: [{ startDate: { lt: rangeEndExclusive } }, { endDate: { gt: rangeStart } }],
    },
  });
  return overlapping === 0;
}

export async function createBooking(
  renterId: string,
  data: { equipmentId: string; startDate: Date; endDate: Date; notes?: string }
) {
  const equipment = await prisma.equipment.findUnique({ where: { id: data.equipmentId } });
  if (
    !equipment ||
    !equipment.isAvailable ||
    equipment.approvalStatus !== "APPROVED"
  ) {
    throw new NotFoundError("Equipment");
  }
  if (equipment.ownerId === renterId) {
    throw new ForbiddenError("You cannot book your own equipment");
  }

  const start = startOfDay(data.startDate);
  const end = startOfDay(data.endDate);
  if (end.getTime() < start.getTime()) {
    throw new ValidationError("End date must be on or after start date");
  }

  const available = await isAvailable(data.equipmentId, start, end);
  if (!available) {
    throw new ConflictError("Equipment is not available for these dates");
  }

  const pricing = calculatePrice(equipment, start, end);
  const bookingEnd = endOfDay(end);

  const booking = await prisma.booking.create({
    data: {
      renterId,
      ownerId: equipment.ownerId,
      equipmentId: equipment.id,
      status: BookingStatus.PENDING,
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
          status: PaymentStatus.PENDING,
        },
      },
      delivery: {
        create: {
          status: DeliveryStatus.SCHEDULED,
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

  void sendBookingRequestEmail(booking.owner, booking.renter, booking.equipment, booking).catch(
    (err) => logNonCriticalEmailFailure("booking_request", err, { bookingId: booking.id })
  );
  void notifyBookingRequest(
    booking.ownerId,
    booking.renter.name,
    booking.equipment.title,
    booking.id
  ).catch(() => {});

  return booking;
}

export async function getMyBookings(userId: string) {
  const asRenter = await prisma.booking.findMany({
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
  const asOwner = await prisma.booking.findMany({
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

export async function getBookingById(id: string, userId: string) {
  const booking = await prisma.booking.findUnique({
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
    throw new NotFoundError("Booking");
  }
  return booking;
}

export function canTransition(current: BookingStatus, next: BookingStatus): boolean {
  return BookingStateConfig[current].allowedTransitions.includes(next);
}

export async function transitionBooking(
  bookingId: string,
  nextStatus: BookingStatus,
  userId: string
): Promise<Booking> {
  const booking = await prisma.booking.findUnique({
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
    throw new NotFoundError("Booking");
  }
  if (booking.renterId !== userId && booking.ownerId !== userId) {
    throw new ForbiddenError();
  }
  if (!canTransition(booking.status, nextStatus)) {
    throw new InvalidTransitionError(booking.status, nextStatus);
  }

  const updated = await prisma.booking.update({
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

  if (nextStatus === BookingStatus.CONFIRMED) {
    void sendBookingConfirmedEmail(updated.renter, updated.equipment, updated).catch((err) =>
      logNonCriticalEmailFailure("booking_confirmed", err, { bookingId: updated.id })
    );
  }
  if (nextStatus === BookingStatus.REJECTED) {
    void sendBookingRejectedEmail(updated.renter, updated.equipment).catch((err) =>
      logNonCriticalEmailFailure("booking_rejected", err, { bookingId: updated.id })
    );
  }
  if (nextStatus === BookingStatus.PICKUP_SCHEDULED && updated.delivery) {
    void sendDeliveryScheduledEmail(updated.renter, updated.delivery, updated).catch((err) =>
      logNonCriticalEmailFailure("delivery_scheduled", err, { bookingId: updated.id })
    );
    const slot =
      updated.delivery.deliverySlot?.toISOString() ??
      updated.delivery.returnSlot?.toISOString() ??
      "soon";
    void notifyDeliveryScheduled(updated.renterId, updated.equipment.title, updated.id, slot).catch(() => {});
  }

  return updated;
}

export async function approveBooking(bookingId: string, ownerId: string): Promise<Booking> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.ownerId !== ownerId) {
    throw new NotFoundError("Booking");
  }
  if (booking.status !== BookingStatus.PENDING) {
    throw new BusinessError("Booking is not pending approval");
  }

  const current = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.PAYMENT_PENDING },
    include: {
      equipment: true,
      owner: true,
      renter: true,
      delivery: true,
      payment: true,
    },
  });
  void sendBookingConfirmedEmail(current.renter, current.equipment, current).catch((err) =>
    logNonCriticalEmailFailure("booking_confirmed", err, { bookingId: bookingId })
  );
  void notifyBookingApproved(current.renterId, current.equipment.title, bookingId).catch(() => {});

  return current;
}

export async function rejectBooking(
  bookingId: string,
  ownerId: string,
  reason?: string
): Promise<Booking> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.ownerId !== ownerId) {
    throw new NotFoundError("Booking");
  }
  if (!canTransition(booking.status, BookingStatus.REJECTED)) {
    throw new BusinessError("Cannot reject booking in current status");
  }

  const notes =
    reason !== undefined && reason !== ""
      ? `${booking.notes ?? ""}\nRejection reason: ${reason}`.trim()
      : booking.notes;

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.REJECTED, ...(notes !== undefined ? { notes } : {}) },
    include: {
      equipment: true,
      owner: true,
      renter: true,
      delivery: true,
      payment: true,
    },
  });

  void sendBookingRejectedEmail(updated.renter, updated.equipment).catch((err) =>
    logNonCriticalEmailFailure("booking_rejected", err, { bookingId: bookingId })
  );
  void notifyBookingRejected(updated.renterId, updated.equipment.title, bookingId).catch(() => {});
  return updated;
}

export async function cancelBooking(bookingId: string, renterId: string): Promise<Booking> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.renterId !== renterId) {
    throw new NotFoundError("Booking");
  }
  if (!canTransition(booking.status, BookingStatus.CANCELLED)) {
    throw new BusinessError("Booking cannot be cancelled now");
  }
  return prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.CANCELLED },
  });
}

const bookingDetailInclude = {
  equipment: true,
  owner: true,
  renter: true,
  delivery: true,
  payment: true,
} as const;

const ownerHandoverStatuses: BookingStatus[] = [
  BookingStatus.PAID,
  BookingStatus.PICKUP_SCHEDULED,
  BookingStatus.IN_TRANSIT,
];

const ownerReturnCompleteStatuses: BookingStatus[] = [
  BookingStatus.ACTIVE,
  BookingStatus.RETURN_SCHEDULED,
  BookingStatus.RETURNING,
  BookingStatus.INSPECTING,
];

const completeRentalStatuses: BookingStatus[] = [
  BookingStatus.ACTIVE,
  BookingStatus.RETURN_SCHEDULED,
  BookingStatus.RETURNING,
  BookingStatus.INSPECTING,
];

/** After payment: rental is active (no separate delivery scheduling step). */
export async function activateRentalAfterPayment(
  bookingId: string,
  paymentMeta?: { confirmedBy?: string; stripeCheckoutSessionId?: string; stripePaymentIntentId?: string }
): Promise<Booking> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      payment: true,
      delivery: true,
      equipment: { select: { title: true } },
      renter: true,
      owner: true,
    },
  });
  if (!booking || !booking.payment) {
    throw new NotFoundError("Booking");
  }

  if (booking.status === BookingStatus.ACTIVE && booking.payment.status === PaymentStatus.CONFIRMED) {
    return prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: bookingDetailInclude,
    });
  }

  if (booking.status !== BookingStatus.PAYMENT_PENDING && booking.status !== BookingStatus.PAID) {
    throw new BusinessError("Booking is not awaiting payment activation");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { bookingId },
      data: {
        status: PaymentStatus.CONFIRMED,
        confirmedAt: new Date(),
        confirmedBy: paymentMeta?.confirmedBy ?? "system",
        ...(paymentMeta?.stripeCheckoutSessionId
          ? { stripeCheckoutSessionId: paymentMeta.stripeCheckoutSessionId }
          : {}),
        ...(paymentMeta?.stripePaymentIntentId
          ? { stripePaymentIntentId: paymentMeta.stripePaymentIntentId }
          : {}),
      },
    });

    const existingDelivery = await tx.delivery.findUnique({ where: { bookingId } });
    if (existingDelivery) {
      await tx.delivery.update({
        where: { bookingId },
        data: { status: DeliveryStatus.DELIVERED },
      });
    } else {
      await tx.delivery.create({
        data: {
          bookingId,
          status: DeliveryStatus.DELIVERED,
          pickupPhotos: [],
          returnPhotos: [],
        },
      });
    }

    return tx.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.ACTIVE },
      include: bookingDetailInclude,
    });
  });

  void notifyPaymentConfirmed(
    updated.renterId,
    updated.ownerId,
    updated.equipment.title,
    updated.id
  ).catch(() => undefined);

  return updated;
}

/** Owner or renter closes an active rental in one step. */
export async function completeRental(bookingId: string, userId: string): Promise<Booking> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { delivery: true, payment: true },
  });
  if (!booking || (booking.renterId !== userId && booking.ownerId !== userId)) {
    throw new NotFoundError("Booking");
  }
  if (!completeRentalStatuses.includes(booking.status)) {
    throw new BusinessError("This rental cannot be completed yet");
  }

  const rentalStart = new Date(booking.startDate);
  rentalStart.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today < rentalStart) {
    throw new BusinessError("This rental cannot be completed before the rental start date");
  }

  return prisma.$transaction(async (tx) => {
    if (booking.delivery) {
      await tx.delivery.update({
        where: { bookingId },
        data: { status: DeliveryStatus.RETURNED },
      });
    }
    if (booking.payment?.status === PaymentStatus.CONFIRMED) {
      await tx.payment.update({
        where: { bookingId },
        data: { status: PaymentStatus.PAYOUT_PENDING },
      });
    }
    return tx.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.COMPLETED },
      include: bookingDetailInclude,
    });
  });
}

/** Owner marks equipment handed to renter (skips agent steps for self-coordinated delivery). */
export async function ownerHandoverToRenter(bookingId: string, ownerId: string): Promise<Booking> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { delivery: true },
  });
  if (!booking || booking.ownerId !== ownerId) {
    throw new NotFoundError("Booking");
  }
  if (!ownerHandoverStatuses.includes(booking.status)) {
    throw new BusinessError("This booking cannot be marked as handed over yet");
  }

  return prisma.$transaction(async (tx) => {
    if (booking.delivery) {
      await tx.delivery.update({
        where: { bookingId },
        data: { status: DeliveryStatus.DELIVERED },
      });
    }
    return tx.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.ACTIVE },
      include: bookingDetailInclude,
    });
  });
}

/** @deprecated Use completeRental — kept for older clients */
export async function ownerConfirmReturnComplete(
  bookingId: string,
  ownerId: string
): Promise<Booking> {
  return completeRental(bookingId, ownerId);
}

export async function confirmDelivery(bookingId: string, renterId: string): Promise<Booking> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { delivery: true },
  });
  if (!booking || booking.renterId !== renterId) {
    throw new NotFoundError("Booking");
  }
  if (!canTransition(booking.status, BookingStatus.ACTIVE)) {
    throw new InvalidTransitionError(booking.status, BookingStatus.ACTIVE);
  }

  return prisma.$transaction(async (tx) => {
    if (booking.delivery) {
      await tx.delivery.update({
        where: { bookingId },
        data: { status: DeliveryStatus.DELIVERED },
      });
    }
    return tx.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.ACTIVE },
      include: bookingDetailInclude,
    });
  });
}

export async function requestReturn(bookingId: string, renterId: string): Promise<Booking> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { delivery: true },
  });
  if (!booking || booking.renterId !== renterId) {
    throw new NotFoundError("Booking");
  }
  if (!canTransition(booking.status, BookingStatus.RETURN_SCHEDULED)) {
    throw new InvalidTransitionError(booking.status, BookingStatus.RETURN_SCHEDULED);
  }

  return prisma.$transaction(async (tx) => {
    if (booking.delivery) {
      await tx.delivery.update({
        where: { bookingId },
        data: { status: DeliveryStatus.RETURN_SCHEDULED },
      });
    }
    return tx.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.RETURN_SCHEDULED },
      include: bookingDetailInclude,
    });
  });
}

export async function raiseDispute(
  bookingId: string,
  userId: string,
  reason: string,
  evidence: string[]
): Promise<Booking> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { owner: true, renter: true },
  });
  if (!booking || (booking.renterId !== userId && booking.ownerId !== userId)) {
    throw new NotFoundError("Booking");
  }
  if (!canTransition(booking.status, BookingStatus.DISPUTED)) {
    throw new BusinessError("Cannot open a dispute for this booking state");
  }

  await prisma.dispute.create({
    data: {
      bookingId,
      raisedById: userId,
      reason,
      evidence,
      status: DisputeStatus.OPEN,
    },
  });

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.DISPUTED },
    include: {
      equipment: true,
      owner: true,
      renter: true,
    },
  });

  void sendDisputeOpenedEmail(updated.owner, updated.renter, updated).catch((err) =>
    logNonCriticalEmailFailure("dispute_opened", err, { bookingId: bookingId })
  );
  void notifyDisputeOpened(updated.ownerId, updated.renterId, bookingId).catch(() => {});

  return updated;
}
