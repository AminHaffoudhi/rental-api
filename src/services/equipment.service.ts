import { BookingStatus, EquipmentApprovalStatus, Prisma, ReviewStatus, ReviewType } from "@prisma/client";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  deleteFile,
  PUBLIC_BUCKET,
  tryExtractKeyFromPublicUrl,
} from "@/lib/storage";
import {
  notifyEquipmentApproved,
  notifyEquipmentPendingReview,
  notifyEquipmentRejected,
} from "@/services/notification.service";
import { assertCategoryId, categoryPublicSelect, resolveCategoryId } from "@/services/category.service";
import {
  approvedEquipmentReviewWhere,
  attachEquipmentReviewSummaries,
  attachEquipmentReviewSummary,
} from "@/utils/reviewStats";

function alignImageKeys(images: string[], imageKeys: string[]): string[] {
  return images.map((url, i) => {
    const explicit = imageKeys[i]?.trim();
    if (explicit) return explicit;
    return tryExtractKeyFromPublicUrl(url) ?? "";
  });
}

export type EquipmentSearchFilters = {
  q?: string;
  categoryId?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  limit?: number;
  page?: number;
  pageSize?: number;
  sort?: string;
  availableOnly?: boolean;
};

const equipmentInclude = {
  category: { select: categoryPublicSelect },
  owner: {
    select: { id: true, name: true, image: true, role: true, kycStatus: true },
  },
  reviews: {
    where: approvedEquipmentReviewWhere,
    select: { id: true, rating: true },
  },
} as const;

function equipmentDetailReviewsWhere(
  viewerUserId: string | undefined,
  isOwner: boolean
): Prisma.ReviewWhereInput {
  if (isOwner) {
    return { type: ReviewType.EQUIPMENT };
  }
  if (!viewerUserId) {
    return approvedEquipmentReviewWhere;
  }
  return {
    type: ReviewType.EQUIPMENT,
    OR: [approvedEquipmentReviewWhere, { reviewerId: viewerUserId }],
  };
}

function equipmentDetailInclude(viewerUserId: string | undefined, ownerId: string) {
  const isOwner = Boolean(viewerUserId && viewerUserId === ownerId);
  return {
    category: { select: categoryPublicSelect },
    owner: {
      select: {
        id: true,
        name: true,
        image: true,
        role: true,
        kycStatus: true,
        createdAt: true,
      },
    },
    reviews: {
      where: equipmentDetailReviewsWhere(viewerUserId, isOwner),
      include: {
        reviewer: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: "desc" as const },
    },
  };
}

function collectStorageKeys(row: { images: string[]; imageKeys: string[] }): Set<string> {
  const keys = new Set<string>();
  for (const k of row.imageKeys ?? []) {
    if (k) keys.add(k);
  }
  for (const url of row.images ?? []) {
    const k = tryExtractKeyFromPublicUrl(url);
    if (k) keys.add(k);
  }
  return keys;
}

async function deleteRemovedPublicKeys(
  before: { images: string[]; imageKeys: string[] },
  after: { images: string[]; imageKeys: string[] }
): Promise<void> {
  const prev = collectStorageKeys(before);
  const next = collectStorageKeys(after);
  await Promise.allSettled(
    [...prev].filter((k) => !next.has(k)).map((k) => deleteFile(PUBLIC_BUCKET, k))
  );
}

function assertCanViewEquipment(
  row: { ownerId: string; approvalStatus: EquipmentApprovalStatus },
  viewerUserId?: string
): void {
  if (row.approvalStatus === EquipmentApprovalStatus.APPROVED) return;
  if (viewerUserId && row.ownerId === viewerUserId) return;
  throw new NotFoundError("Equipment");
}

export async function searchEquipment(filters: EquipmentSearchFilters) {
  const availableOnly = filters.availableOnly !== false;
  const resolvedCategoryId = await resolveCategoryId(filters.categoryId, filters.category);

  const where: Prisma.EquipmentWhereInput = {
    approvalStatus: EquipmentApprovalStatus.APPROVED,
    ...(availableOnly ? { isAvailable: true } : {}),
    ...(resolvedCategoryId ? { categoryId: resolvedCategoryId } : {}),
    ...(filters.location
      ? { location: { contains: filters.location, mode: "insensitive" } }
      : {}),
    ...(filters.minPrice !== undefined || filters.maxPrice !== undefined
      ? {
          dailyRate: {
            ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
            ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
          },
        }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { title: { contains: filters.q, mode: "insensitive" } },
            { description: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const simpleLimit = filters.limit !== undefined && filters.page === undefined;
  const pageSize = Math.min(
    simpleLimit ? filters.limit! : filters.pageSize ?? 12,
    100
  );
  const page = Math.max(filters.page ?? 1, 1);
  const skip = simpleLimit ? 0 : (page - 1) * pageSize;
  const take = simpleLimit ? Math.min(filters.limit!, 100) : pageSize;

  let orderBy: Prisma.EquipmentOrderByWithRelationInput | Prisma.EquipmentOrderByWithRelationInput[] =
    { createdAt: "desc" };
  switch (filters.sort) {
    case "price_asc":
      orderBy = { dailyRate: "asc" };
      break;
    case "price_desc":
      orderBy = { dailyRate: "desc" };
      break;
    case "rating":
      orderBy = { createdAt: "desc" };
      break;
    case "recent":
    default:
      orderBy = { createdAt: "desc" };
  }

  const [total, rows] = await prisma.$transaction([
    prisma.equipment.count({ where }),
    prisma.equipment.findMany({
      where,
      include: equipmentInclude,
      orderBy,
      skip,
      take,
    }),
  ]);

  let items = attachEquipmentReviewSummaries(rows);
  if (filters.sort === "rating") {
    items = [...items].sort((a, b) => {
      const ar = a.averageRating ?? 0;
      const br = b.averageRating ?? 0;
      return br - ar;
    });
  }

  return { items, total };
}

export async function listOwnerEquipment(ownerId: string) {
  const rows = await prisma.equipment.findMany({
    where: { ownerId },
    include: equipmentInclude,
    orderBy: { createdAt: "desc" },
  });
  return attachEquipmentReviewSummaries(rows);
}

export async function getEquipmentById(id: string, viewerUserId?: string) {
  const base = await prisma.equipment.findUnique({ where: { id } });
  if (!base) {
    throw new NotFoundError("Equipment");
  }
  assertCanViewEquipment(base, viewerUserId);

  const full = await prisma.equipment.findUnique({
    where: { id },
    include: equipmentDetailInclude(viewerUserId, base.ownerId),
  });
  if (!full) {
    throw new NotFoundError("Equipment");
  }

  const approvedReviews = full.reviews.filter((r) => r.status === ReviewStatus.APPROVED);
  const summary = attachEquipmentReviewSummary({ ...full, reviews: approvedReviews });
  return { ...summary, reviews: full.reviews };
}

export async function createEquipment(
  ownerId: string,
  data: {
    title: string;
    description: string;
    categoryId: string;
    dailyRate: number;
    weeklyRate?: number;
    depositAmount: number;
    deliveryFee: number;
    location: string;
    images?: string[];
    imageKeys?: string[];
  }
) {
  await assertCategoryId(data.categoryId);

  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { name: true },
  });

  const row = await prisma.equipment.create({
    data: {
      title: data.title,
      description: data.description,
      categoryId: data.categoryId,
      dailyRate: data.dailyRate,
      weeklyRate: data.weeklyRate,
      depositAmount: data.depositAmount,
      deliveryFee: data.deliveryFee,
      location: data.location,
      images: data.images ?? [],
      imageKeys: alignImageKeys(data.images ?? [], data.imageKeys ?? []),
      ownerId,
      approvalStatus: EquipmentApprovalStatus.PENDING,
      isAvailable: false,
    },
    include: equipmentInclude,
  });

  void notifyEquipmentPendingReview(row.id, row.title, owner?.name ?? "Owner").catch(
    () => undefined
  );

  return row;
}

export async function updateEquipment(
  id: string,
  ownerId: string,
  data: Partial<{
    title: string;
    description: string;
    categoryId: string;
    dailyRate: number;
    weeklyRate: number | null;
    depositAmount: number;
    deliveryFee: number;
    location: string;
    images: string[];
    imageKeys: string[];
    isAvailable: boolean;
  }>
) {
  const existing = await prisma.equipment.findUnique({ where: { id } });
  if (!existing || existing.ownerId !== ownerId) {
    throw new NotFoundError("Equipment");
  }

  if (data.isAvailable === true && existing.approvalStatus !== EquipmentApprovalStatus.APPROVED) {
    throw new ValidationError(
      "Listing must be approved by an admin before it can go live in search"
    );
  }

  if (data.categoryId !== undefined) {
    await assertCategoryId(data.categoryId);
  }

  const mergedImages = data.images !== undefined ? data.images : existing.images;
  const mergedKeys = alignImageKeys(
    mergedImages,
    data.imageKeys !== undefined ? data.imageKeys : existing.imageKeys
  );

  if (data.images !== undefined || data.imageKeys !== undefined) {
    await deleteRemovedPublicKeys(
      { images: existing.images, imageKeys: existing.imageKeys },
      { images: mergedImages, imageKeys: mergedKeys }
    );
  }

  const resubmit =
    existing.approvalStatus === EquipmentApprovalStatus.REJECTED &&
    (data.title !== undefined ||
      data.description !== undefined ||
      data.images !== undefined ||
      data.categoryId !== undefined);

  const { images: _i, imageKeys: _k, isAvailable, ...rest } = data;
  const row = await prisma.equipment.update({
    where: { id },
    data: {
      ...rest,
      ...(isAvailable !== undefined ? { isAvailable } : {}),
      ...(data.images !== undefined ? { images: mergedImages } : {}),
      ...(data.images !== undefined || data.imageKeys !== undefined ? { imageKeys: mergedKeys } : {}),
      ...(resubmit
        ? {
            approvalStatus: EquipmentApprovalStatus.PENDING,
            isAvailable: false,
            rejectionNote: null,
            approvedAt: null,
          }
        : {}),
    },
    include: equipmentInclude,
  });

  if (resubmit) {
    void notifyEquipmentPendingReview(row.id, row.title, row.owner.name).catch(() => undefined);
  }

  return row;
}

export async function deleteEquipment(id: string, ownerId: string) {
  const existing = await prisma.equipment.findUnique({ where: { id } });
  if (!existing || existing.ownerId !== ownerId) {
    throw new NotFoundError("Equipment");
  }

  const keys = collectStorageKeys({
    images: existing.images,
    imageKeys: existing.imageKeys,
  });
  await Promise.allSettled([...keys].map((k) => deleteFile(PUBLIC_BUCKET, k)));

  await prisma.equipment.delete({ where: { id } });
}

export async function getAvailability(equipmentId: string, month: string, viewerUserId?: string) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { ownerId: true, approvalStatus: true },
  });
  if (!equipment) {
    throw new NotFoundError("Equipment");
  }
  assertCanViewEquipment(equipment, viewerUserId);

  const start = new Date(`${month}-01T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    throw new ValidationError("Invalid month format. Use YYYY-MM.");
  }
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  const bookings = await prisma.booking.findMany({
    where: {
      equipmentId,
      status: {
        notIn: [BookingStatus.REJECTED, BookingStatus.CANCELLED, BookingStatus.REFUNDED],
      },
      AND: [{ startDate: { lte: end } }, { endDate: { gte: start } }],
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      status: true,
    },
    orderBy: { startDate: "asc" },
  });

  return { month, ranges: bookings };
}
