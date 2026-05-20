import { BookingStatus } from "@prisma/client";
import { BusinessError, ForbiddenError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export async function createReview(
  reviewerId: string,
  data: {
    bookingId: string;
    revieweeId: string;
    equipmentId: string;
    rating: number;
    comment?: string;
  }
) {
  const booking = await prisma.booking.findUnique({
    where: { id: data.bookingId },
  });
  if (!booking || booking.status !== BookingStatus.COMPLETED) {
    throw new BusinessError("Booking must be completed before reviewing");
  }
  if (booking.renterId !== reviewerId && booking.ownerId !== reviewerId) {
    throw new ForbiddenError();
  }
  if (data.revieweeId !== booking.renterId && data.revieweeId !== booking.ownerId) {
    throw new ValidationError("Invalid reviewee");
  }
  if (data.revieweeId === reviewerId) {
    throw new ValidationError("Cannot review yourself");
  }
  if (booking.equipmentId !== data.equipmentId) {
    throw new ValidationError("Equipment mismatch");
  }

  return prisma.review.create({
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
