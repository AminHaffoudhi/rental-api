import { sendToAdmins, sendToUser, sendToUsers } from "@/lib/onesignal";

const BASE_URL = (process.env.CLIENT_URL ?? "http://localhost:5174").replace(/\/+$/, "");
const ADMIN_URL = (process.env.ADMIN_CLIENT_URL ?? "http://localhost:5175").replace(
  /\/+$/,
  ""
);

export async function notifyNewUserRegistered(userId: string, userName: string, userEmail: string): Promise<void> {
  await sendToAdmins({
    title: "New user registered",
    message: `${userName} (${userEmail}) just created an account`,
    url: `${ADMIN_URL}/users`,
    data: { type: "new_user", userId },
  });
}

export async function notifyKycSubmitted(userId: string, userName: string): Promise<void> {
  await sendToAdmins({
    title: "New KYC submission",
    message: `${userName} submitted their identity document for review`,
    url: `${ADMIN_URL}/users?tab=pending`,
    data: { type: "kyc_submitted", userId },
  });
}

export async function notifyKycApproved(userId: string): Promise<void> {
  await sendToUser(userId, {
    title: "🎉 You're verified! Start listing equipment",
    message: "Your identity has been approved by our team. You can now create listings and start earning.",
    url: `${BASE_URL}/equipment/new`,
    data: { type: "kyc_approved" },
  });
}

export async function notifyKycRejected(userId: string, reason: string): Promise<void> {
  await sendToUser(userId, {
    title: "⚠️ Identity verification needs attention",
    message: `Your document was not accepted: ${reason.slice(0, 100)}. Please re-upload.`,
    url: `${BASE_URL}/profile`,
    data: { type: "kyc_rejected", reason },
  });
}

export async function notifyBookingRequest(
  ownerId: string,
  renterName: string,
  equipmentTitle: string,
  bookingId: string
): Promise<void> {
  await sendToUser(ownerId, {
    title: "New booking request",
    message: `${renterName} wants to rent "${equipmentTitle}"`,
    url: `${BASE_URL}/dashboard/bookings`,
    data: { type: "booking_request", bookingId },
  });
}

export async function notifyBookingApproved(
  renterId: string,
  equipmentTitle: string,
  bookingId: string
): Promise<void> {
  await sendToUser(renterId, {
    title: "Booking approved!",
    message: `Your booking for "${equipmentTitle}" was approved. Complete your payment to confirm.`,
    url: `${BASE_URL}/bookings/${bookingId}`,
    data: { type: "booking_approved", bookingId },
  });
}

export async function notifyBookingRejected(
  renterId: string,
  equipmentTitle: string,
  bookingId: string
): Promise<void> {
  await sendToUser(renterId, {
    title: "Booking not approved",
    message: `Your request for "${equipmentTitle}" was declined.`,
    url: `${BASE_URL}/bookings/${bookingId}`,
    data: { type: "booking_rejected", bookingId },
  });
}

export async function notifyPaymentConfirmed(
  renterId: string,
  ownerId: string,
  equipmentTitle: string,
  bookingId: string
): Promise<void> {
  await sendToUser(renterId, {
    title: "Payment confirmed",
    message: `Payment for "${equipmentTitle}" confirmed. Delivery will be scheduled soon.`,
    url: `${BASE_URL}/bookings/${bookingId}`,
    data: { type: "payment_confirmed", bookingId },
  });
  await sendToUser(ownerId, {
    title: "Payment received",
    message: `Payment for "${equipmentTitle}" has been confirmed.`,
    url: `${BASE_URL}/dashboard/bookings`,
    data: { type: "payment_received", bookingId },
  });
}

export async function notifyDeliveryScheduled(
  renterId: string,
  equipmentTitle: string,
  bookingId: string,
  slot: string
): Promise<void> {
  await sendToUser(renterId, {
    title: "Delivery scheduled",
    message: `"${equipmentTitle}" will be delivered on ${slot}`,
    url: `${BASE_URL}/bookings/${bookingId}`,
    data: { type: "delivery_scheduled", bookingId },
  });
}

export async function notifyReturnReminder(
  renterId: string,
  equipmentTitle: string,
  bookingId: string
): Promise<void> {
  await sendToUser(renterId, {
    title: "Return reminder",
    message: `"${equipmentTitle}" is due back tomorrow. Please have it ready for pickup.`,
    url: `${BASE_URL}/bookings/${bookingId}`,
    data: { type: "return_reminder", bookingId },
  });
}

export async function notifyDisputeOpened(ownerId: string, renterId: string, bookingId: string): Promise<void> {
  const payload = {
    title: "Dispute opened",
    message: "A dispute has been raised on your booking. Our team will review it shortly.",
    url: `${BASE_URL}/bookings/${bookingId}`,
    data: { type: "dispute_opened", bookingId },
  };
  await sendToUsers([ownerId, renterId], payload);
  await sendToAdmins({
    title: "New dispute requires review",
    message: `A dispute was opened on booking ${bookingId.slice(0, 8)}`,
    url: `${ADMIN_URL}/users`,
    data: { type: "dispute_admin", bookingId },
  });
}

export async function notifyPayoutSent(ownerId: string, amount: number, equipmentTitle: string): Promise<void> {
  await sendToUser(ownerId, {
    title: "Payout sent!",
    message: `${amount} TND for "${equipmentTitle}" is on its way to your account.`,
    url: `${BASE_URL}/dashboard/earnings`,
    data: { type: "payout_sent", amount },
  });
}

export async function notifyEquipmentPendingReview(
  equipmentId: string,
  title: string,
  ownerName: string
): Promise<void> {
  await sendToAdmins({
    title: "New listing pending approval",
    message: `${ownerName} submitted "${title}" for review`,
    url: `${ADMIN_URL}/equipment?highlight=${equipmentId}`,
    data: { type: "equipment_pending", equipmentId },
  });
}

export async function notifyEquipmentApproved(ownerId: string, title: string, equipmentId: string): Promise<void> {
  await sendToUser(ownerId, {
    title: "Listing approved",
    message: `"${title}" is now live. Turn on visibility when you're ready for renters to find it.`,
    url: `${BASE_URL}/dashboard/listings?highlight=${equipmentId}`,
    data: { type: "equipment_approved", equipmentId },
  });
}

export async function notifyAdminsNewReview(
  reviewId: string,
  type: string,
  reviewerName: string,
  targetLabel: string
): Promise<void> {
  await sendToAdmins({
    title: "New review pending moderation",
    message: `${reviewerName} submitted a ${type === "EQUIPMENT" ? "listing" : "owner"} review for "${targetLabel}"`,
    url: `${ADMIN_URL}/reviews?highlight=${reviewId}`,
    data: { type: "review_pending", reviewId },
  });
}

export async function notifyOwnerReviewReceived(ownerId: string, reviewerName: string): Promise<void> {
  await sendToUser(ownerId, {
    title: "New review on your profile",
    message: `${reviewerName} left you a review. It will appear after admin approval.`,
    url: `${BASE_URL}/users/${ownerId}`,
    data: { type: "review_owner_received" },
  });
}

export async function notifyOwnerEquipmentReviewed(
  ownerId: string,
  reviewerName: string,
  equipmentTitle: string,
  equipmentId: string
): Promise<void> {
  await sendToUser(ownerId, {
    title: "New review on your listing",
    message: `${reviewerName} reviewed "${equipmentTitle}". Pending admin approval.`,
    url: `${BASE_URL}/dashboard/listings?highlight=${equipmentId}`,
    data: { type: "review_equipment_received", equipmentId },
  });
}

export async function notifyReviewApproved(
  ownerId: string,
  type: string,
  reviewerName: string,
  targetLabel: string,
  options?: { equipmentId?: string | null; reviewId?: string }
): Promise<void> {
  const highlight = options?.reviewId ? `?highlight=${options.reviewId}` : "";
  const url =
    type === "EQUIPMENT" && options?.equipmentId
      ? `${BASE_URL}/equipment/${options.equipmentId}${highlight}`
      : `${BASE_URL}/users/${ownerId}${highlight}`;

  await sendToUser(ownerId, {
    title: type === "EQUIPMENT" ? "Listing review published" : "Profile review published",
    message: `A review from ${reviewerName} about "${targetLabel}" is now visible.`,
    url,
    data: { type: "review_approved" },
  });
}

export async function notifyEquipmentRejected(
  ownerId: string,
  title: string,
  note: string,
  equipmentId: string
): Promise<void> {
  await sendToUser(ownerId, {
    title: "Listing needs changes",
    message: `"${title}" was not approved: ${note.slice(0, 120)}. Edit and resubmit from My Listings.`,
    url: `${BASE_URL}/dashboard/listings?highlight=${equipmentId}`,
    data: { type: "equipment_rejected", note, equipmentId },
  });
}
