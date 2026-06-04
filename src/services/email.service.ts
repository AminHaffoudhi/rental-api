import type { Booking, Delivery, Equipment, User } from "@prisma/client";
import { PLATFORM_NAME } from "@/config/brand";
import { sendMail } from "@/lib/mailer";
import logger from "@/lib/logger";
import { formatCurrency } from "@/utils/currency";
import { formatDate } from "@/utils/dates";

export function baseTemplate(content: string): string {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
             background: #fafaf9; margin: 0; padding: 0; }
      .wrapper { max-width: 560px; margin: 40px auto; padding: 0 16px; }
      .card { background: #fff; border-radius: 16px; border: 1px solid #e7e5e4;
              overflow: hidden; }
      .header { background: #f97316; padding: 32px 40px; text-align: center; }
      .header h1 { color: white; font-size: 22px; margin: 0;
                   font-family: Georgia, serif; letter-spacing: -0.5px; }
      .body { padding: 40px; }
      .code-box { background: #fff8f1; border: 2px dashed #ffd9a8;
                  border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; }
      .code { font-size: 42px; font-weight: 800; letter-spacing: 12px;
              color: #c24b08; font-family: 'Courier New', monospace; }
      .code-label { font-size: 13px; color: #78716c; margin-top: 8px; }
      .btn { display: inline-block; background: #f97316; color: white !important;
             padding: 14px 32px; border-radius: 10px; text-decoration: none;
             font-weight: 600; font-size: 15px; margin: 16px 0; }
      .footer { padding: 24px 40px; background: #fafaf9;
                border-top: 1px solid #f5f5f4; text-align: center;
                color: #a8a29e; font-size: 12px; }
      p { color: #44403c; line-height: 1.7; margin: 0 0 16px; }
      .warning { background: #fef9c3; border: 1px solid #fde68a;
                 border-radius: 8px; padding: 12px 16px; font-size: 13px;
                 color: #92400e; margin-top: 16px; }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="card">
        <div class="header">
          <h1>● ${PLATFORM_NAME}</h1>
        </div>
        <div class="body">${content}</div>
        <div class="footer">
          © 2026 ${PLATFORM_NAME} · Tunisia<br>
          This email was sent to you because you have an account on ${PLATFORM_NAME}.
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
}

export type SendEmailMeta = Record<string, unknown>;

export function logNonCriticalEmailFailure(
  type: string,
  err: unknown,
  extra?: Record<string, unknown>
): void {
  logger.warn("Email notification failed (non-critical)", {
    type,
    error: err instanceof Error ? err.message : String(err),
    ...extra,
  });
}

const clientBase = () => (process.env.CLIENT_URL ?? "").replace(/\/+$/, "");

export async function sendVerificationCodeEmail(
  to: string,
  name: string,
  code: string
): Promise<void> {
  await sendMail({
    to,
    subject: `${code} — Your ${PLATFORM_NAME} verification code`,
    html: baseTemplate(`
      <p>Hi <strong>${escapeHtml(name)}</strong>,</p>
      <p>Use this code to verify your email address:</p>
      <div class="code-box">
        <div class="code">${escapeHtml(code)}</div>
        <div class="code-label">Expires in 10 minutes</div>
      </div>
      <div class="warning">
        Never share this code with anyone. ${PLATFORM_NAME} will never ask for it.
      </div>
    `),
    text: `Your ${PLATFORM_NAME} verification code is: ${code} (expires in 10 minutes)`,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendKycSubmittedEmail(to: string, name: string): Promise<void> {
  await sendMail({
    to,
    subject: `Identity document received — ${PLATFORM_NAME}`,
    html: baseTemplate(`
      <p>Hi <strong>${escapeHtml(name)}</strong>,</p>
      <p>We've received your identity document. Our team will review it within <strong>24–48 hours</strong>.</p>
      <p>You'll receive an email as soon as your account is verified.</p>
      <p style="color:#78716c;font-size:13px">
        In the meantime, you can complete your profile and explore listings.
      </p>
    `),
  });
}

export async function sendKycApprovedEmail(to: string, name: string): Promise<void> {
  const base = clientBase();
  await sendMail({
    to,
    subject: "Your account is verified — you can now list equipment",
    html: baseTemplate(`
      <p>Hi <strong>${escapeHtml(name)}</strong>,</p>
      <p>Great news! Your identity has been <strong style="color:#16a34a">verified</strong>.</p>
      <p>You can now list your equipment on ${PLATFORM_NAME} and start earning.</p>
      <a href="${base}/equipment/new" class="btn">
        Create Your First Listing →
      </a>
    `),
  });
}

export async function sendKycRejectedEmail(
  to: string,
  name: string,
  reason: string
): Promise<void> {
  const base = clientBase();
  await sendMail({
    to,
    subject: "Action required — Identity verification issue",
    html: baseTemplate(`
      <p>Hi <strong>${escapeHtml(name)}</strong>,</p>
      <p>We were unable to verify your identity document.</p>
      <div class="warning">
        <strong>Reason:</strong> ${escapeHtml(reason)}
      </div>
      <p style="margin-top:16px">Please re-upload a clear, valid document:</p>
      <a href="${base}/profile" class="btn">
        Re-upload Document →
      </a>
    `),
  });
}

export async function sendBookingRequestEmail(
  owner: Pick<User, "email" | "name">,
  renter: Pick<User, "name">,
  equipment: Pick<Equipment, "title">,
  booking: Pick<Booking, "id" | "startDate" | "endDate" | "totalPrice">
): Promise<void> {
  const dates = `${formatDate(booking.startDate)} → ${formatDate(booking.endDate)}`;
  const base = clientBase();
  await sendMail({
    to: owner.email,
    subject: `New booking request — "${equipment.title}"`,
    html: baseTemplate(`
      <p>Hi <strong>${escapeHtml(owner.name)}</strong>,</p>
      <p><strong>${escapeHtml(renter.name)}</strong> wants to rent your <strong>${escapeHtml(equipment.title)}</strong>.</p>
      <p><strong>Dates:</strong> ${escapeHtml(dates)}</p>
      <a href="${base}/dashboard/bookings" class="btn">
        Review Request →
      </a>
    `),
  });
}

export async function sendBookingConfirmedEmail(
  renter: Pick<User, "email" | "name">,
  equipment: Pick<Equipment, "title">,
  booking: Pick<Booking, "id" | "startDate" | "endDate">
): Promise<void> {
  const dates = `${formatDate(booking.startDate)} → ${formatDate(booking.endDate)}`;
  const base = clientBase();
  await sendMail({
    to: renter.email,
    subject: `Booking confirmed — "${equipment.title}"`,
    html: baseTemplate(`
      <p>Hi <strong>${escapeHtml(renter.name)}</strong>,</p>
      <p>Your booking for <strong>${escapeHtml(equipment.title)}</strong> has been approved.</p>
      <p><strong>Dates:</strong> ${escapeHtml(dates)}</p>
      <a href="${base}/bookings/${booking.id}" class="btn">
        View Booking →
      </a>
    `),
  });
}

export async function sendBookingRejectedEmail(
  renter: Pick<User, "email" | "name">,
  equipment: Pick<Equipment, "title">
): Promise<void> {
  await sendMail({
    to: renter.email,
    subject: `Booking update: ${equipment.title}`,
    html: baseTemplate(`
      <p>Hi <strong>${escapeHtml(renter.name)}</strong>,</p>
      <p>Your booking request for <strong>${escapeHtml(equipment.title)}</strong> was declined.</p>
    `),
  });
}

export async function sendDeliveryScheduledEmail(
  renter: Pick<User, "email" | "name">,
  delivery: Pick<Delivery, "deliverySlot" | "returnSlot">,
  booking: Pick<Booking, "id">
): Promise<void> {
  await sendMail({
    to: renter.email,
    subject: `Delivery scheduled for booking ${booking.id}`,
    html: baseTemplate(`
      <p>Hi <strong>${escapeHtml(renter.name)}</strong>,</p>
      <p>Delivery details were updated.</p>
      <p>${delivery.deliverySlot ? `Pickup slot: ${delivery.deliverySlot.toISOString()}` : ""}</p>
      <p>${delivery.returnSlot ? `Return slot: ${delivery.returnSlot.toISOString()}` : ""}</p>
    `),
  });
}

export async function sendReturnReminderEmail(
  renter: Pick<User, "email" | "name">,
  booking: Pick<Booking, "id" | "endDate">,
  equipmentTitle: string
): Promise<void> {
  const base = clientBase();
  const returnDate = formatDate(booking.endDate);
  await sendMail({
    to: renter.email,
    subject: `Return reminder — "${equipmentTitle}" due tomorrow`,
    html: baseTemplate(`
      <p>Hi <strong>${escapeHtml(renter.name)}</strong>,</p>
      <p>Your rental of <strong>${escapeHtml(equipmentTitle)}</strong> is due back tomorrow.</p>
      <p><strong>Return date:</strong> ${escapeHtml(returnDate)}</p>
      <a href="${base}/bookings/${booking.id}" class="btn">
        Manage Return →
      </a>
    `),
  });
}

export async function sendPayoutSentEmail(
  owner: Pick<User, "email" | "name">,
  amount: number,
  equipmentTitle: string,
  bookingId: string
): Promise<void> {
  const base = clientBase();
  await sendMail({
    to: owner.email,
    subject: `Payout sent — ${amount} TND`,
    html: baseTemplate(`
      <p>Hi <strong>${escapeHtml(owner.name)}</strong>,</p>
      <p>Your payout of <strong>${amount} TND</strong> for <strong>${escapeHtml(equipmentTitle)}</strong> has been processed.</p>
      <a href="${base}/dashboard/earnings" class="btn">
        View Earnings →
      </a>
    `),
  });
}

export async function sendDisputeOpenedEmail(
  owner: Pick<User, "email" | "name">,
  renter: Pick<User, "name">,
  booking: Pick<Booking, "id">
): Promise<void> {
  await sendMail({
    to: owner.email,
    subject: `Dispute opened — booking ${booking.id}`,
    html: baseTemplate(`
      <p>Hi <strong>${escapeHtml(owner.name)}</strong>,</p>
      <p>${escapeHtml(renter.name)} opened a dispute on booking <strong>${booking.id}</strong>.</p>
    `),
  });
}
