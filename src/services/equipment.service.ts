import { BookingStatus, Category, Prisma } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  deleteFile,
  PUBLIC_BUCKET,
  tryExtractKeyFromPublicUrl,
} from "@/lib/storage";

function alignImageKeys(images: string[], imageKeys: string[]): string[] {
  return images.map((url, i) => {
    const explicit = imageKeys[i]?.trim();
    if (explicit) return explicit;
    return tryExtractKeyFromPublicUrl(url) ?? "";
  });
}

export type EquipmentSearchFilters = {
  q?: string;
  category?: Category;
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  limit?: number;
  page?: number;
  pageSize?: number;
  /** recent | price_asc | price_desc | rating */
  sort?: string;
  /** When false, include unavailable listings. Default true. */
  availableOnly?: boolean;
};

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

export async function searchEquipment(filters: EquipmentSearchFilters) {
  const availableOnly = filters.availableOnly !== false;

  const where: Prisma.EquipmentWhereInput = {
    ...(availableOnly ? { isAvailable: true } : {}),
    ...(filters.category ? { category: filters.category } : {}),
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
      orderBy = { reviews: { _count: "desc" } };
      break;
    case "recent":
    default:
      orderBy = { createdAt: "desc" };
  }

  const [total, items] = await prisma.$transaction([
    prisma.equipment.count({ where }),
    prisma.equipment.findMany({
      where,
      include: {
        owner: {
          select: { id: true, name: true, image: true, role: true },
        },
        reviews: {
          select: { rating: true },
        },
      },
      orderBy,
      skip,
      take,
    }),
  ]);

  return { items, total };
}

export async function getEquipmentById(id: string) {
  const row = await prisma.equipment.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          image: true,
          role: true,
          createdAt: true,
        },
      },
      reviews: {
        include: {
          reviewer: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!row) {
    throw new NotFoundError("Equipment");
  }
  return row;
}

export async function createEquipment(
  ownerId: string,
  data: {
    title: string;
    description: string;
    category: Category;
    dailyRate: number;
    weeklyRate?: number;
    depositAmount: number;
    deliveryFee: number;
    location: string;
    images?: string[];
    imageKeys?: string[];
  }
) {
  return prisma.equipment.create({
    data: {
      title: data.title,
      description: data.description,
      category: data.category,
      dailyRate: data.dailyRate,
      weeklyRate: data.weeklyRate,
      depositAmount: data.depositAmount,
      deliveryFee: data.deliveryFee,
      location: data.location,
      images: data.images ?? [],
      imageKeys: alignImageKeys(data.images ?? [], data.imageKeys ?? []),
      ownerId,
    },
  });
}

export async function updateEquipment(
  id: string,
  ownerId: string,
  data: Partial<{
    title: string;
    description: string;
    category: Category;
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

  const { images: _i, imageKeys: _k, ...rest } = data;
  return prisma.equipment.update({
    where: { id },
    data: {
      ...rest,
      ...(data.images !== undefined ? { images: mergedImages } : {}),
      ...(data.images !== undefined || data.imageKeys !== undefined ? { imageKeys: mergedKeys } : {}),
    },
  });
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

export async function getAvailability(equipmentId: string, month: string) {
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
