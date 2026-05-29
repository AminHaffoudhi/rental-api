import { EquipmentApprovalStatus, KycStatus, ReviewStatus } from "@prisma/client";
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

  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const ownerEquipment = await prisma.equipment.findMany({
    where: {
      ownerId: userId,
      OR: [
        {
          approvalStatus: EquipmentApprovalStatus.PENDING,
          createdAt: { gte: twoWeeksAgo },
        },
        {
          approvalStatus: EquipmentApprovalStatus.APPROVED,
          approvedAt: { gte: twoWeeksAgo },
        },
        {
          approvalStatus: EquipmentApprovalStatus.REJECTED,
          updatedAt: { gte: twoWeeksAgo },
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      approvalStatus: true,
      rejectionNote: true,
      createdAt: true,
      approvedAt: true,
      updatedAt: true,
    },
  });

  for (const e of ownerEquipment) {
    if (e.approvalStatus === EquipmentApprovalStatus.PENDING) {
      notifications.push({
        id: `equipment-pending-${e.id}`,
        type: "equipment_pending",
        title: "Listing submitted for review",
        body: `"${e.title}" is waiting for admin approval.`,
        url: `${BASE_URL}/dashboard/listings?highlight=${e.id}`,
        timestamp: e.createdAt,
        read: false,
      });
    } else if (e.approvalStatus === EquipmentApprovalStatus.APPROVED && e.approvedAt) {
      notifications.push({
        id: `equipment-approved-${e.id}`,
        type: "equipment_approved",
        title: "Listing approved",
        body: `"${e.title}" was approved. Turn on visibility when you're ready to go live.`,
        url: `${BASE_URL}/dashboard/listings?highlight=${e.id}`,
        timestamp: e.approvedAt,
        read: false,
      });
    } else if (e.approvalStatus === EquipmentApprovalStatus.REJECTED) {
      const reason = e.rejectionNote?.trim() || "Please review the feedback and update your listing.";
      notifications.push({
        id: `equipment-rejected-${e.id}`,
        type: "equipment_rejected",
        title: "Listing needs changes",
        body: `"${e.title}" was not approved: ${reason.slice(0, 120)}`,
        url: `${BASE_URL}/dashboard/listings?highlight=${e.id}`,
        timestamp: e.updatedAt,
        read: false,
      });
    }
  }

  const reviewsAboutMe = await prisma.review.findMany({
    where: {
      revieweeId: userId,
      createdAt: { gte: twoWeeksAgo },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      reviewer: { select: { name: true } },
      equipment: { select: { title: true } },
    },
  });

  for (const r of reviewsAboutMe) {
    if (r.status === ReviewStatus.PENDING) {
      notifications.push({
        id: `review-received-pending-${r.id}`,
        type: r.type === "EQUIPMENT" ? "review_equipment_received" : "review_owner_received",
        title:
          r.type === "EQUIPMENT"
            ? "New review on your listing"
            : "New review on your profile",
        body:
          r.type === "EQUIPMENT"
            ? `${r.reviewer.name} reviewed "${r.equipment?.title ?? "your listing"}" — pending approval.`
            : `${r.reviewer.name} left you a review — pending approval.`,
        url:
          r.type === "EQUIPMENT" && r.equipmentId
            ? `${BASE_URL}/dashboard/listings?highlight=${r.equipmentId}`
            : `${BASE_URL}/profile`,
        timestamp: r.createdAt,
        read: false,
      });
    } else if (r.status === ReviewStatus.APPROVED && r.moderatedAt) {
      notifications.push({
        id: `review-approved-${r.id}`,
        type: "review_approved",
        title: r.type === "EQUIPMENT" ? "Listing review published" : "Profile review published",
        body:
          r.type === "EQUIPMENT"
            ? `A review from ${r.reviewer.name} on "${r.equipment?.title ?? "your listing"}" is now live.`
            : `A review from ${r.reviewer.name} is now visible on your profile.`,
        url:
          r.type === "EQUIPMENT" && r.equipmentId
            ? `${BASE_URL}/equipment/${r.equipmentId}`
            : `${BASE_URL}/users/${userId}`,
        timestamp: r.moderatedAt,
        read: false,
      });
    }
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
