import bcrypt from "bcryptjs";
import { CodeType, type Role, type User } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { ConflictError, NotFoundError, BusinessError } from "@/lib/errors";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { sendVerificationCodeEmail } from "@/services/email.service";
import { notifyNewUserRegistered } from "@/services/notification.service";
import { createVerificationCode, getRemainingCooldown, verifyCode } from "@/services/verification.service";
import { HttpError } from "@/utils/httpError";
import { signToken } from "@/utils/jwt";

export type SafeUser = Omit<User, "password">;

function toSafeUser(user: User): SafeUser {
  const { password: _p, ...rest } = user;
  return rest;
}

export type RegisterResult = {
  user: SafeUser;
  token: string;
  message: string;
};

export async function register(data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role?: Role;
}): Promise<RegisterResult> {
  const hashed = await bcrypt.hash(data.password, 12);

  let user: User;
  const effectiveRole = data.role ?? "RENTER";
  try {
    user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        password: hashed,
        phone: data.phone,
        emailVerified: false,
        canList: effectiveRole === "RENTER",
        ...(data.role ? { role: data.role } : {}),
      },
    });
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ConflictError("An account with this email already exists");
    }
    throw e;
  }

  void notifyNewUserRegistered(user.id, user.name, user.email).catch(() => {});

  const code = await createVerificationCode(user.id, CodeType.EMAIL_VERIFICATION);

  const jwt = signToken({
    id: user.id,
    role: user.role,
    email: user.email,
    canList: user.canList,
  });

  void sendVerificationCodeEmail(user.email, user.name, code).catch((err) => {
    logger.warn("Verification email failed — user created but email may not have been sent", {
      userId: user.id,
      email: user.email,
      error: err instanceof Error ? err.message : String(err),
      hint: "Check SMTP_USER and SMTP_PASS in .env (Gmail App Password).",
    });
  });

  return {
    user: toSafeUser(user),
    token: jwt,
    message: "Check your email for a 6-digit verification code.",
  };
}

export async function verifyEmailWithCode(
  code: string
): Promise<{ user: SafeUser; token: string; message: string }> {
  const trimmed = code?.trim() ?? "";
  if (!/^\d{6}$/.test(trimmed)) {
    throw new HttpError(400, "Enter the 6-digit code from your email");
  }

  const userId = await verifyCode(trimmed, CodeType.EMAIL_VERIFICATION);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true },
  });

  const jwt = signToken({
    id: updated.id,
    role: updated.role,
    email: updated.email,
    canList: updated.canList,
  });

  return {
    user: toSafeUser(updated),
    token: jwt,
    message: "Email verified successfully.",
  };
}

export async function resendVerificationCode(userId: string): Promise<{ message: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError("User");
  }
  if (user.emailVerified) {
    return { message: "Email is already verified." };
  }

  const remaining = await getRemainingCooldown(userId, CodeType.EMAIL_VERIFICATION);
  if (remaining > 0) {
    throw new BusinessError(
      `Please wait ${remaining} seconds before requesting a new code.`,
      "RESEND_COOLDOWN",
      { seconds: remaining }
    );
  }

  const code = await createVerificationCode(userId, CodeType.EMAIL_VERIFICATION);
  void sendVerificationCodeEmail(user.email, user.name, code).catch((err) => {
    logger.warn("Resend verification code email failed", {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return { message: "New code sent." };
}

/** Resend for users who are not carrying a session (e.g. came from login with unverified email). */
export async function resendVerificationCodeByEmail(email: string): Promise<{ message: string }> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!user) {
    return { message: "If an account exists for this email, you'll receive a new code shortly." };
  }
  if (user.emailVerified) {
    return { message: "Email is already verified." };
  }
  return resendVerificationCode(user.id);
}

export async function login(
  email: string,
  password: string
): Promise<{ user: SafeUser; token: string }> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!user?.password) {
    throw new HttpError(401, "Invalid credentials");
  }
  if (!user.emailVerified) {
    throw new HttpError(
      403,
      "Please verify your email before signing in. Check your inbox or request a new code.",
      "EMAIL_NOT_VERIFIED"
    );
  }
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    throw new HttpError(401, "Invalid credentials");
  }
  const jwt = signToken({
    id: user.id,
    role: user.role,
    email: user.email,
    canList: user.canList,
  });
  return { user: toSafeUser(user), token: jwt };
}

export async function getMe(userId: string): Promise<SafeUser & { kycDocument: unknown }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { kycDocument: true },
  });
  if (!user) {
    throw new NotFoundError("User");
  }
  return toSafeUser(user) as SafeUser & { kycDocument: unknown };
}
