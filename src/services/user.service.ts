import { ReviewStatus, ReviewType, type User } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { deleteFile, PUBLIC_BUCKET, tryExtractKeyFromPublicUrl } from "@/lib/storage";
import { categoryPublicSelect } from "@/services/category.service";
import {
  approvedEquipmentReviewWhere,
  approvedOwnerReviewWhere,
  attachEquipmentReviewSummaries,
} from "@/utils/reviewStats";

export type SafeUser = Omit<User, "password">;

function toSafeUser(user: User): SafeUser {
  const { password: _p, ...rest } = user;
  return rest;
}

async function deleteStoredUrlIfOwned(
  userId: string,
  oldUrl: string | null | undefined,
  folderPrefix: string
): Promise<void> {
  if (!oldUrl) return;
  const key = tryExtractKeyFromPublicUrl(oldUrl);
  if (key && key.startsWith(`${folderPrefix}/${userId}/`)) {
    void deleteFile(PUBLIC_BUCKET, key);
  }
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      image: true,
      coverImage: true,
      bio: true,
      location: true,
      role: true,
      kycStatus: true,
      createdAt: true,
      equipment: {
        where: { isAvailable: true, approvalStatus: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 24,
        include: {
          category: { select: categoryPublicSelect },
          owner: { select: { id: true, name: true, image: true, role: true } },
          reviews: {
            where: approvedEquipmentReviewWhere,
            select: { id: true, rating: true },
          },
        },
      },
      reviewsReceived: {
        where: approvedOwnerReviewWhere,
        include: {
          reviewer: { select: { id: true, name: true, image: true } },
          equipment: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      },
      _count: {
        select: {
          equipment: { where: { isAvailable: true, approvalStatus: "APPROVED" } },
        },
      },
    },
  });
  if (!user) {
    throw new NotFoundError("User");
  }

  const { _count, reviewsReceived: ownerReviews, equipment, ...rest } = user;

  const [listingReviews, reviewAggregate] = await Promise.all([
    prisma.review.findMany({
      where: {
        ...approvedEquipmentReviewWhere,
        equipment: { ownerId: id },
      },
      include: {
        reviewer: { select: { id: true, name: true, image: true } },
        equipment: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.review.aggregate({
      where: {
        status: ReviewStatus.APPROVED,
        OR: [
          { revieweeId: id, type: ReviewType.OWNER },
          { type: ReviewType.EQUIPMENT, equipment: { ownerId: id } },
        ],
      },
      _avg: { rating: true },
      _count: { id: true },
    }),
  ]);

  const reviewsReceived = [...ownerReviews, ...listingReviews].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  const reviewCount = reviewAggregate._count.id;
  const avgRaw = reviewAggregate._avg.rating;

  return {
    ...rest,
    equipment: attachEquipmentReviewSummaries(equipment),
    reviewsReceived,
    stats: {
      listings: _count.equipment,
      reviews: reviewCount,
      avgRating:
        avgRaw !== null ? Math.round(avgRaw * 10) / 10 : null,
    },
  };
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
  data: {
    name?: string;
    phone?: string;
    image?: string;
    coverImage?: string;
    bio?: string;
    location?: string;
  }
): Promise<SafeUser> {
  const existing = await prisma.user.findUnique({
    where: { id },
    select: { image: true, coverImage: true },
  });
  if (!existing) {
    throw new NotFoundError("User");
  }

  if (data.image !== undefined && data.image !== existing.image) {
    await deleteStoredUrlIfOwned(id, existing.image, "avatars");
  }
  if (data.coverImage !== undefined && data.coverImage !== existing.coverImage) {
    await deleteStoredUrlIfOwned(id, existing.coverImage, "covers");
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.image !== undefined ? { image: data.image || null } : {}),
      ...(data.coverImage !== undefined ? { coverImage: data.coverImage || null } : {}),
      ...(data.bio !== undefined ? { bio: data.bio.trim() } : {}),
      ...(data.location !== undefined ? { location: data.location.trim() || null } : {}),
    },
  });
  return toSafeUser(user);
}
