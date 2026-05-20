import { KycStatus } from "@prisma/client";
import { CLIENT_URL } from "@/config/env";
import { prisma } from "@/lib/prisma";

export interface UserNotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string;
  timestamp: Date;
  read: boolean;
}

const BASE_URL = CLIENT_URL.replace(/\/+$/, "");

export async function listForUser(userId: string): Promise<UserNotificationDto[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { kycDocument: true },
  });
  if (!user) {
    return [];
  }

  const notifications: UserNotificationDto[] = [];

  if (user.kycStatus === KycStatus.APPROVED && user.kycDocument?.reviewedAt) {
    notifications.push({
      id: `kyc-approved-${user.id}`,
      type: "kyc_approved",
      title: "🎉 You're verified! Start listing equipment",
      body: "Your identity has been approved. You can now create listings and start earning.",
      url: `${BASE_URL}/equipment/new`,
      timestamp: user.kycDocument.reviewedAt,
      read: false,
    });
  }

  if (user.kycStatus === KycStatus.REJECTED && user.kycDocument?.reviewedAt) {
    const reason = user.kycDocument.adminNote?.trim() || "Please review the requirements and re-upload.";
    notifications.push({
      id: `kyc-rejected-${user.id}`,
      type: "kyc_rejected",
      title: "⚠️ Identity verification needs attention",
      body: `Your document was not accepted: ${reason.slice(0, 100)}. Please re-upload.`,
      url: `${BASE_URL}/profile`,
      timestamp: user.kycDocument.reviewedAt,
      read: false,
    });
  }

  if (user.kycStatus === KycStatus.SUBMITTED) {
    notifications.push({
      id: `kyc-pending-${user.id}`,
      type: "kyc_submitted",
      title: "🪪 Identity document under review",
      body: "Our team is reviewing your submission. We'll notify you when it's complete.",
      url: `${BASE_URL}/profile`,
      timestamp: user.kycDocument?.submittedAt ?? user.updatedAt,
      read: false,
    });
  }

  const recentBookings = await prisma.booking.findMany({
    where: {
      OR: [{ renterId: userId }, { ownerId: userId }],
      updatedAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    include: { equipment: { select: { title: true } } },
  });

  for (const b of recentBookings) {
    const isOwner = b.ownerId === userId;
    const title = b.equipment.title;
    let type = "general";
    let notifTitle = "Booking update";
    let body = `Your booking for "${title}" was updated.`;
    let url = `${BASE_URL}/bookings/${b.id}`;

    if (b.status === "PENDING" && isOwner) {
      type = "booking_request";
      notifTitle = "📬 New booking request";
      body = `Someone requested to rent "${title}".`;
      url = `${BASE_URL}/dashboard/bookings`;
    } else if (b.status === "CONFIRMED" && !isOwner) {
      type = "booking_approved";
      notifTitle = "🎉 Booking approved";
      body = `Your request for "${title}" was approved. Complete payment to confirm.`;
    } else if (b.status === "REJECTED" && !isOwner) {
      type = "booking_rejected";
      notifTitle = "Booking declined";
      body = `Your request for "${title}" was not approved.`;
    } else if (b.status === "PAID" || b.status === "PAYMENT_PENDING") {
      type = "payment_confirmed";
      notifTitle = "💳 Payment update";
      body = `Payment status updated for "${title}".`;
    }

    notifications.push({
      id: `booking-${b.id}-${b.status}`,
      type,
      title: notifTitle,
      body,
      url,
      timestamp: b.updatedAt,
      read: false,
    });
  }

  return notifications
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);
}
