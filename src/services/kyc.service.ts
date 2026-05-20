import { BusinessError, NotFoundError } from "@/lib/errors";
import { sendMail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import {
  baseTemplate,
  sendKycSubmittedEmail,
} from "@/services/email.service";
import { notifyKycSubmitted } from "@/services/notification.service";
import logger from "@/lib/logger";

const ADMIN_BASE = () =>
  (process.env.ADMIN_CLIENT_URL ?? process.env.CLIENT_URL ?? "").replace(/\/+$/, "") ||
  "http://localhost:5175";

export async function submitKyc(
  userId: string,
  documentUrl: string,
  documentType: string
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError("User");
  }

  if (user.role === "RENTER") {
    throw new BusinessError("Renters do not need identity verification.", "KYC_NOT_REQUIRED");
  }

  const existing = await prisma.kycDocument.findUnique({ where: { userId } });
  if (existing?.status === "SUBMITTED") {
    throw new BusinessError(
      "Your document is already under review. Please wait for admin approval.",
      "KYC_ALREADY_SUBMITTED"
    );
  }

  await prisma.kycDocument.upsert({
    where: { userId },
    create: { userId, documentUrl, documentType, status: "SUBMITTED" },
    update: {
      documentUrl,
      documentType,
      status: "SUBMITTED",
      adminNote: null,
      reviewedBy: null,
      reviewedAt: null,
      submittedAt: new Date(),
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { kycStatus: "SUBMITTED" },
  });

  logger.info("KYC document submitted", { userId });

  void notifyKycSubmitted(userId, user.name).catch(() => {});
  void notifyAdminKycSubmitted(user.name, user.email).catch(() => {});
  void sendKycSubmittedEmail(user.email, user.name).catch(() => {});
}

export async function getKycStatus(userId: string) {
  const doc = await prisma.kycDocument.findUnique({ where: { userId } });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { kycStatus: true, canList: true, role: true },
  });
  return { document: doc, kycStatus: user?.kycStatus, canList: user?.canList, role: user?.role };
}

async function notifyAdminKycSubmitted(name: string, email: string): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { email: true, name: true },
  });
  const base = ADMIN_BASE();
  for (const admin of admins) {
    await sendMail({
      to: admin.email,
      subject: `New KYC submission — ${name}`,
      html: baseTemplate(`
        <p>Hi <strong>${escape(admin.name)}</strong>,</p>
        <p><strong>${escape(name)}</strong> (${escape(email)}) has submitted their identity document for review.</p>
        <a href="${base}/users" class="btn">
          Review in Admin Panel →
        </a>
      `),
    });
  }
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
