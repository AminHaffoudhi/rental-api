import { ReviewStatus, ReviewType } from "@prisma/client";

export const approvedEquipmentReviewWhere = {
  status: ReviewStatus.APPROVED,
  type: ReviewType.EQUIPMENT,
} as const;

export const approvedOwnerReviewWhere = {
  status: ReviewStatus.APPROVED,
  type: ReviewType.OWNER,
} as const;

export function attachEquipmentReviewSummary<T extends { reviews?: { rating: number }[] }>(
  row: T
): T & { reviewCount: number; averageRating: number | null } {
  const reviews = row.reviews ?? [];
  const reviewCount = reviews.length;
  const averageRating =
    reviewCount > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviewCount) * 10) / 10
      : null;
  return { ...row, reviewCount, averageRating };
}

export function attachEquipmentReviewSummaries<T extends { reviews?: { rating: number }[] }>(
  rows: T[]
): (T & { reviewCount: number; averageRating: number | null })[] {
  return rows.map(attachEquipmentReviewSummary);
}
