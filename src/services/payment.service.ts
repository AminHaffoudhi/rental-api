import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export async function getPaymentByBooking(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || (booking.renterId !== userId && booking.ownerId !== userId)) {
    throw new NotFoundError("Booking");
  }
  const payment = await prisma.payment.findUnique({
    where: { bookingId },
    include: { booking: { include: { equipment: true } } },
  });
  if (!payment) {
    throw new NotFoundError("Payment");
  }
  return payment;
}
