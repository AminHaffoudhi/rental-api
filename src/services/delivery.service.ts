import { DeliveryStatus } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

async function assertBookingParticipant(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || (booking.renterId !== userId && booking.ownerId !== userId)) {
    throw new ForbiddenError();
  }
}

export async function getDelivery(deliveryId: string, userId: string) {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: { booking: true },
  });
  if (!delivery) {
    throw new NotFoundError("Delivery");
  }
  await assertBookingParticipant(delivery.bookingId, userId);
  return delivery;
}

export async function uploadPickupPhotos(deliveryId: string, photos: string[], userId: string) {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: { booking: true },
  });
  if (!delivery) {
    throw new NotFoundError("Delivery");
  }
  await assertBookingParticipant(delivery.bookingId, userId);

  return prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      pickupPhotos: [...delivery.pickupPhotos, ...photos],
      status: DeliveryStatus.PICKED_UP,
    },
  });
}

export async function uploadReturnPhotos(deliveryId: string, photos: string[], userId: string) {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: { booking: true },
  });
  if (!delivery) {
    throw new NotFoundError("Delivery");
  }
  await assertBookingParticipant(delivery.bookingId, userId);

  return prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      returnPhotos: [...delivery.returnPhotos, ...photos],
      status: DeliveryStatus.RETURN_PICKED_UP,
    },
  });
}
