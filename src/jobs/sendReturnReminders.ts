import { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  logNonCriticalEmailFailure,
  sendReturnReminderEmail,
} from "@/services/email.service";
import { notifyReturnReminder } from "@/services/notification.service";
import { addDays, endOfDay, startOfDay } from "@/utils/dates";

export async function sendReturnReminders(): Promise<void> {
  const tomorrowStart = startOfDay(addDays(new Date(), 1));
  const tomorrowEnd = endOfDay(addDays(new Date(), 1));

  const bookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.ACTIVE,
      endDate: {
        gte: tomorrowStart,
        lte: tomorrowEnd,
      },
    },
    include: {
      renter: true,
      equipment: { select: { title: true } },
    },
  });

  for (const booking of bookings) {
    void sendReturnReminderEmail(booking.renter, booking, booking.equipment.title).catch((err) =>
      logNonCriticalEmailFailure("return_reminder", err, { bookingId: booking.id })
    );
    void notifyReturnReminder(booking.renterId, booking.equipment.title, booking.id).catch(() => {});
  }
}
