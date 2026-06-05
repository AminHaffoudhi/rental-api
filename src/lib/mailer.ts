import dns from "node:dns";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { PLATFORM_NAME } from "@/config/brand";
import logger from "@/lib/logger";

const host = process.env.SMTP_HOST || "smtp.gmail.com";
const port = Number(process.env.SMTP_PORT) || 587;
const user = process.env.SMTP_USER?.trim();
/** App passwords are often copied with spaces — strip them. */
const pass = process.env.SMTP_PASS?.trim().replace(/\s+/g, "");
const resendApiKey = process.env.RESEND_API_KEY?.trim();

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

function resolveFromAddress(displayName: string): string {
  const from = process.env.EMAIL_FROM?.trim() || user;
  if (!from) {
    throw new Error("EMAIL_FROM or SMTP_USER is not set — cannot send email");
  }
  return `"${displayName}" <${from}>`;
}

if (resendApiKey) {
  logger.info("Email transport: Resend HTTP API (works on Render free tier)", {
    from: process.env.EMAIL_FROM?.trim() || user,
  });
} else {
  void transporter.verify().then(() => {
    logger.info("Email transport: SMTP connected", { host, port, user });
  }).catch((err: unknown) => {
    logger.warn("SMTP connection failed — set RESEND_API_KEY on Render free tier", {
      error: err instanceof Error ? err.message : String(err),
      hint: "Render blocks outbound SMTP ports 465/587 on free plans. Use https://resend.com",
    });
  });
}

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

async function sendViaResend(from: string, options: MailOptions): Promise<string> {
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      reply_to: options.replyTo,
    }),
  });

  const data = (await res.json()) as { id?: string; message?: string; name?: string };
  if (!res.ok) {
    throw new Error(data.message ?? data.name ?? `Resend API error ${res.status}`);
  }
  return data.id ?? "resend";
}

export async function sendMail(options: MailOptions): Promise<void> {
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    logger.info("[DEV] Sending email", {
      to: options.to,
      subject: options.subject,
      transport: resendApiKey ? "resend" : "smtp",
    });
  }

  const from = resolveFromAddress(PLATFORM_NAME);

  try {
    if (resendApiKey) {
      const messageId = await sendViaResend(from, options);
      logger.info("Email sent", { messageId, to: options.to, transport: "resend" });
      return;
    }

    const info = await transporter.sendMail({
      from,
      ...options,
    });
    logger.info("Email sent", { messageId: info.messageId, to: options.to, transport: "smtp" });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Failed to send email", {
      to: options.to,
      subject: options.subject,
      error: error.message,
      transport: resendApiKey ? "resend" : "smtp",
      hint: resendApiKey
        ? "Check RESEND_API_KEY and verify your sender domain in Resend."
        : "On Render free tier set RESEND_API_KEY. For local dev use SMTP_* vars.",
    });
    throw error;
  }
}
