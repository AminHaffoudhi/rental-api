import { SupportReportType } from "@prisma/client";
import { PLATFORM_NAME } from "@/config/brand";
import { sendMail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { notifySupportReport } from "@/services/notification.service";
import type { ContactFormInput } from "@/validators/contact.validator";

function supportInbox(): string {
  const dedicated = process.env.SUPPORT_EMAIL?.trim();
  if (dedicated) return dedicated;
  const smtpUser = process.env.SMTP_USER?.trim();
  if (smtpUser) return smtpUser;
  return "support@ekri.tn";
}

export async function submitContactForm(data: ContactFormInput): Promise<{ id: string }> {
  const type = data.type === "REPORT" ? SupportReportType.REPORT : SupportReportType.CONTACT;
  const subject =
    data.subject?.trim() ||
    (type === SupportReportType.REPORT ? "Issue report" : "General inquiry");

  const report = await prisma.supportReport.create({
    data: {
      type,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email.toLowerCase(),
      phone: data.phone?.trim() || null,
      subject,
      message: data.message,
    },
    select: { id: true },
  });

  const label = type === SupportReportType.REPORT ? "Issue report" : "Support request";
  const phoneLine = data.phone
    ? `<p><strong>Phone:</strong> ${escapeHtml(data.phone)}</p>`
    : "";

  try {
    await sendMail({
      to: supportInbox(),
      subject: `[${PLATFORM_NAME}] ${label} — ${data.firstName} ${data.lastName}`,
      html: `
        <p><strong>New ${label.toLowerCase()}</strong> on ${PLATFORM_NAME}</p>
        <p><strong>Reference:</strong> ${report.id}</p>
        <p><strong>Name:</strong> ${escapeHtml(data.firstName)} ${escapeHtml(data.lastName)}</p>
        <p><strong>Email:</strong> <a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></p>
        ${phoneLine}
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space:pre-wrap">${escapeHtml(data.message)}</p>
      `,
      text: [
        `New ${label.toLowerCase()} on ${PLATFORM_NAME}`,
        `Reference: ${report.id}`,
        `Name: ${data.firstName} ${data.lastName}`,
        `Email: ${data.email}`,
        data.phone ? `Phone: ${data.phone}` : null,
        `Subject: ${subject}`,
        "",
        data.message,
      ]
        .filter(Boolean)
        .join("\n"),
      replyTo: data.email,
    });
  } catch (err) {
    console.error("[contact] Email notification failed (report saved):", err);
  }

  const senderName = `${data.firstName} ${data.lastName}`.trim();
  void notifySupportReport(report.id, type, senderName, subject).catch((err) => {
    console.error("[contact] Admin push notification failed:", err);
  });

  return report;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
