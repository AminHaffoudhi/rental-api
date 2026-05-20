import { CodeType } from "@prisma/client";
import { BusinessError } from "@/lib/errors";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createVerificationCode(
  userId: string,
  type: CodeType
): Promise<string> {
  await prisma.verificationCode.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.verificationCode.create({
    data: { userId, code, type, expiresAt },
  });

  logger.debug("Verification code created", { userId, type });
  return code;
}

export async function verifyCode(code: string, type: CodeType): Promise<string> {
  const record = await prisma.verificationCode.findFirst({
    where: {
      code,
      type,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!record) {
    throw new BusinessError(
      "Invalid or expired verification code. Please request a new one.",
      "INVALID_CODE"
    );
  }

  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return record.userId;
}

export async function getRemainingCooldown(userId: string, type: CodeType): Promise<number> {
  const latest = await prisma.verificationCode.findFirst({
    where: { userId, type },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) {
    return 0;
  }

  const cooldownMs = 60 * 1000;
  const elapsed = Date.now() - latest.createdAt.getTime();
  const remaining = cooldownMs - elapsed;

  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}
