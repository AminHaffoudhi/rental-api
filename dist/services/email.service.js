"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.sendBookingRequestEmail = sendBookingRequestEmail;
exports.sendBookingConfirmedEmail = sendBookingConfirmedEmail;
exports.sendBookingRejectedEmail = sendBookingRejectedEmail;
exports.sendDeliveryScheduledEmail = sendDeliveryScheduledEmail;
exports.sendReturnReminderEmail = sendReturnReminderEmail;
exports.sendPayoutSentEmail = sendPayoutSentEmail;
exports.sendDisputeOpenedEmail = sendDisputeOpenedEmail;
const resend_1 = require("resend");
const env_1 = require("@/config/env");
const currency_1 = require("@/utils/currency");
const dates_1 = require("@/utils/dates");
const resend = new resend_1.Resend(env_1.RESEND_API_KEY);
async function sendEmail(to, subject, htmlBody) {
    await resend.emails.send({
        from: "Rental <onboarding@resend.dev>",
        to,
        subject,
        html: htmlBody,
    });
}
async function sendBookingRequestEmail(owner, renter, equipment, booking) {
    await sendEmail(owner.email, `New booking request for ${equipment.title}`, `<p>Hi ${owner.name},</p>
     <p>${renter.name} requested to rent <strong>${equipment.title}</strong>.</p>
     <p>Dates: ${(0, dates_1.formatDate)(booking.startDate)} → ${(0, dates_1.formatDate)(booking.endDate)}</p>
     <p>Total: ${(0, currency_1.formatCurrency)(booking.totalPrice)}</p>
     <p>Booking ID: ${booking.id}</p>`);
}
async function sendBookingConfirmedEmail(renter, equipment, booking) {
    await sendEmail(renter.email, `Booking confirmed: ${equipment.title}`, `<p>Hi ${renter.name},</p>
     <p>Your booking for <strong>${equipment.title}</strong> was confirmed.</p>
     <p>Dates: ${(0, dates_1.formatDate)(booking.startDate)} → ${(0, dates_1.formatDate)(booking.endDate)}</p>
     <p>Booking ID: ${booking.id}</p>`);
}
async function sendBookingRejectedEmail(renter, equipment) {
    await sendEmail(renter.email, `Booking update: ${equipment.title}`, `<p>Hi ${renter.name},</p>
     <p>Your booking request for <strong>${equipment.title}</strong> was declined.</p>`);
}
async function sendDeliveryScheduledEmail(renter, delivery, booking) {
    await sendEmail(renter.email, `Delivery scheduled for booking ${booking.id}`, `<p>Hi ${renter.name},</p>
     <p>Delivery details were updated.</p>
     <p>${delivery.deliverySlot ? `Pickup slot: ${delivery.deliverySlot.toISOString()}` : ""}</p>
     <p>${delivery.returnSlot ? `Return slot: ${delivery.returnSlot.toISOString()}` : ""}</p>`);
}
async function sendReturnReminderEmail(renter, booking) {
    await sendEmail(renter.email, `Return reminder — booking ${booking.id}`, `<p>Hi ${renter.name},</p>
     <p>Your rental ends on ${(0, dates_1.formatDate)(booking.endDate)}. Please prepare the return.</p>`);
}
async function sendPayoutSentEmail(owner, booking, amount) {
    await sendEmail(owner.email, `Payout sent for booking ${booking.id}`, `<p>Hi ${owner.name},</p>
     <p>A payout of ${(0, currency_1.formatCurrency)(amount)} was sent for booking <strong>${booking.id}</strong>.</p>`);
}
async function sendDisputeOpenedEmail(owner, renter, booking) {
    await sendEmail(owner.email, `Dispute opened — booking ${booking.id}`, `<p>Hi ${owner.name},</p>
     <p>${renter.name} opened a dispute on booking <strong>${booking.id}</strong>.</p>`);
}
