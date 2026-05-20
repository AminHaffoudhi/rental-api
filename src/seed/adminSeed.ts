import bcrypt from "bcryptjs";
import { KycStatus, Role } from "@prisma/client";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const ADMIN = {
  email: "admin-2@email.com",
  password: "password",
  name: "Platform Admin",
  role: Role.ADMIN,
} as const;

export async function seedAdmin(): Promise<void> {
  try {
    const email = ADMIN.email.toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      logger.info("Admin account already exists", { email });
      return;
    }

    const hashed = await bcrypt.hash(ADMIN.password, 12);

    await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: ADMIN.name,
        role: ADMIN.role,
        emailVerified: true,
        canList: false,
        kycStatus: KycStatus.APPROVED,
      },
    });

    logger.info("Admin account seeded", { email });
  } catch (err) {
    logger.error("Failed to seed admin account", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
