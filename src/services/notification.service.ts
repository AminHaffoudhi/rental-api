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
