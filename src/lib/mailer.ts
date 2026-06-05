import dns from "node:dns";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { PLATFORM_NAME } from "@/config/brand";
import logger from "@/lib/logger";

const host = process.env.SMTP_HOST || "smtp.gmail.com";
const port = Number(process.env.SMTP_PORT) || 587;
const user = process.env.SMTP_USER?.trim();
/** Gmail app passwords are often copied with spaces — strip them. */
const pass = process.env.SMTP_PASS?.trim().replace(/\s+/g, "");

const smtpOptions = {
  host,
  port,
  secure: process.env.SMTP_SECURE === "true",
  auth:
    user && pass
      ? {
          user,
          pass,
        }
      : undefined,
  // Render/cloud hosts often cannot reach Gmail over IPv6 (ENETUNREACH).
  lookup: (hostname: string, _opts: unknown, callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
    dns.lookup(hostname, { family: 4 }, callback);
  },
  connectionTimeout: 15_000,
  greetingTimeout: 15_000,
  socketTimeout: 20_000,
  tls: {
    rejectUnauthorized: false,
  },
} as SMTPTransport.Options;

const transporter = nodemailer.createTransport(smtpOptions);

void transporter.verify().then(() => {
  logger.info("Gmail SMTP connected", { user: process.env.SMTP_USER });
}).catch((err: unknown) => {
  logger.warn("Gmail SMTP connection failed — emails will not send", {
    error: err instanceof Error ? err.message : String(err),
    hint: "Check SMTP_USER and SMTP_PASS in .env. Use Gmail App Password, not your main password.",
  });
});

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendMail(options: MailOptions): Promise<void> {
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    logger.info("[DEV] Sending email", {
      to: options.to,
      subject: options.subject,
    });
  }

  const fromUser = process.env.SMTP_USER?.trim();
  if (!fromUser) {
    const msg = "SMTP_USER is not set — cannot send email";
    logger.error(msg, { to: options.to, subject: options.subject });
    throw new Error(msg);
  }

  try {
    const info = await transporter.sendMail({
      from: `"${PLATFORM_NAME}" <${fromUser}>`,
      ...options,
    });
    logger.info("Email sent", { messageId: info.messageId, to: options.to });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Failed to send email", {
      to: options.to,
      subject: options.subject,
      error: error.message,
      hint: "Check SMTP credentials. For Gmail: enable 2FA + use App Password.",
    });
    throw error;
  }
}
