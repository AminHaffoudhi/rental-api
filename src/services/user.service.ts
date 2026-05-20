import type { User } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { deleteFile, PUBLIC_BUCKET, tryExtractKeyFromPublicUrl } from "@/lib/storage";

export type SafeUser = Omit<User, "password">;

function toSafeUser(user: User): SafeUser {
  const { password: _p, ...rest } = user;
  return rest;
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      createdAt: true,
      equipment: {
        where: { isAvailable: true },
        orderBy: { createdAt: "desc" },
        take: 12,
      },
      reviewsReceived: {
        include: {
          reviewer: { select: { id: true, name: true, image: true } },
          equipment: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  if (!user) {
    throw new NotFoundError("User");
  }
  return user;
}

export async function setOneSignalPlayerId(id: string, playerId: string): Promise<SafeUser> {
  const user = await prisma.user.update({
    where: { id },
    data: { oneSignalPlayerId: playerId },
  });
  return toSafeUser(user);
}

export async function updateUser(
  id: string,
  data: { name?: string; phone?: string; image?: string }
): Promise<SafeUser> {
  if (data.image !== undefined) {
    const existing = await prisma.user.findUnique({
      where: { id },
      select: { image: true },
    });
    const oldUrl = existing?.image;
    const nextUrl = data.image;
    if (oldUrl && nextUrl && oldUrl !== nextUrl) {
      const key = tryExtractKeyFromPublicUrl(oldUrl);
      if (key && key.startsWith(`avatars/${id}/`)) {
        void deleteFile(PUBLIC_BUCKET, key);
      }
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data,
  });
  return toSafeUser(user);
}
