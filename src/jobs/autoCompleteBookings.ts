import { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const HOURS_48_MS = 48 * 60 * 60 * 1000;

export async function autoCompleteBookings(): Promise<void> {
  const cutoff = new Date(Date.now() - HOURS_48_MS);

  const stale = await prisma.booking.findMany({
    where: {
      status: BookingStatus.INSPECTING,
      updatedAt: { lt: cutoff },
    },
    select: { id: true },
  });

  for (const row of stale) {
    await prisma.booking.update({
      where: { id: row.id },
      data: { status: BookingStatus.COMPLETED },
    });
  }
}
