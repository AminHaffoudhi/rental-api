import {
  BookingStatus,
  EquipmentApprovalStatus,
  ReviewStatus,
  ReviewType,
  Role,
  type Prisma,
} from "@prisma/client";
import { BusinessError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  notifyAdminsNewReview,
  notifyOwnerEquipmentReviewed,
  notifyOwnerReviewReceived,
} from "@/services/notification.service";

const reviewInclude = {
  reviewer: { select: { id: true, name: true, image: true } },
  reviewee: { select: { id: true, name: true, image: true } },
  equipment: { select: { id: true, title: true } },
} as const;

const approvedOnly: Prisma.ReviewWhereInput = { status: ReviewStatus.APPROVED };

function assertCanReviewUsers(reviewerId: string, revieweeId: string): void {
  if (reviewerId === revieweeId) {
    throw new ValidationError("Cannot review yourself");
  }
}

async function assertRevieweeIsOwner(revieweeId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: revieweeId },
    select: { role: true },
  });
  if (!user) {
    throw new NotFoundError("User");
  }
  if (user.role !== Role.OWNER && user.role !== Role.BOTH) {
    throw new ValidationError("You can only review equipment owners");
  }
}

async function notifyAfterCreate(
  row: {
    id: string;
    type: ReviewType;
    revieweeId: string;
    equipmentId: string | null;
    reviewer: { name: string };
    reviewee: { name: string };
    equipment: { title: string } | null;
  }
): Promise<void> {
  void notifyAdminsNewReview(
    row.id,
    row.type,
    row.reviewer.name,
    row.type === ReviewType.EQUIPMENT
      ? row.equipment?.title ?? "listing"
      : row.reviewee.name
  ).catch(() => undefined);

  if (row.type === ReviewType.OWNER) {
    void notifyOwnerReviewReceived(row.revieweeId, row.reviewer.name).catch(() => undefined);
  } else {
    void notifyOwnerEquipmentReviewed(
      row.revieweeId,
      row.reviewer.name,
      row.equipment?.title ?? "your listing",
      row.equipmentId ?? ""
    ).catch(() => undefined);
  }
}

export async function createOwnerReview(
  reviewerId: string,
  data: { revieweeId: string; rating: number; comment?: string }
) {
  assertCanReviewUsers(reviewerId, data.revieweeId);
  await assertRevieweeIsOwner(data.revieweeId);

  const existing = await prisma.review.findFirst({
    where: {
      reviewerId,
      revieweeId: data.revieweeId,
      type: ReviewType.OWNER,
    },
  });
  if (existing) {
    throw new ConflictError("You have already reviewed this owner");
  }

  const row = await prisma.review.create({
    data: {
      type: ReviewType.OWNER,
      status: ReviewStatus.PENDING,
      reviewerId,
      revieweeId: data.revieweeId,
      rating: data.rating,
      comment: data.comment?.trim() || null,
    },
    include: reviewInclude,
  });

  await notifyAfterCreate(row);
  return row;
}

export async function createEquipmentReview(
  reviewerId: string,
  data: { equipmentId: string; rating: number; comment?: string }
) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: data.equipmentId },
    select: {
      id: true,
      title: true,
      ownerId: true,
      approvalStatus: true,
    },
  });
  if (!equipment || equipment.approvalStatus !== EquipmentApprovalStatus.APPROVED) {
    throw new NotFoundError("Equipment");
  }
  if (equipment.ownerId === reviewerId) {
    throw new ValidationError("Cannot review your own listing");
  }

  const existing = await prisma.review.findFirst({
    where: {
      reviewerId,
      equipmentId: data.equipmentId,
      type: ReviewType.EQUIPMENT,
    },
  });
  if (existing) {
    throw new ConflictError("You have already reviewed this listing");
  }

  const row = await prisma.review.create({
    data: {
      type: ReviewType.EQUIPMENT,
      status: ReviewStatus.PENDING,
      reviewerId,
      revieweeId: equipment.ownerId,
      equipmentId: equipment.id,
      rating: data.rating,
      comment: data.comment?.trim() || null,
    },
    include: reviewInclude,
  });

  await notifyAfterCreate(row);
  return row;
}

export async function createBookingReview(
  reviewerId: string,
  data: {
    bookingId: string;
    revieweeId: string;
    equipmentId: string;
    type: ReviewType;
    rating: number;
    comment?: string;
  }
) {
  const booking = await prisma.booking.findUnique({
    where: { id: data.bookingId },
    include: { equipment: { select: { title: true, ownerId: true } } },
  });
  if (!booking || booking.status !== BookingStatus.COMPLETED) {
    throw new BusinessError("Booking must be completed before reviewing");
  }
  if (booking.renterId !== reviewerId && booking.ownerId !== reviewerId) {
    throw new ForbiddenError();
  }
  if (booking.equipmentId !== data.equipmentId) {
    throw new ValidationError("Equipment mismatch");
  }

  if (data.type === ReviewType.OWNER) {
    if (data.revieweeId !== booking.renterId && data.revieweeId !== booking.ownerId) {
      throw new ValidationError("Invalid reviewee");
    }
    assertCanReviewUsers(reviewerId, data.revieweeId);
  } else {
    if (data.revieweeId !== booking.ownerId) {
      throw new ValidationError("Invalid reviewee for equipment review");
    }
    if (reviewerId === booking.ownerId) {
      throw new ValidationError("Cannot review your own listing");
    }
  }

  if (data.type === ReviewType.EQUIPMENT) {
    const existingEquipment = await prisma.review.findFirst({
      where: {
        reviewerId,
        equipmentId: data.equipmentId,
        type: ReviewType.EQUIPMENT,
      },
    });
    if (existingEquipment) {
      throw new ConflictError("You have already reviewed this listing");
    }
  } else {
    const existingOwner = await prisma.review.findFirst({
      where: {
        reviewerId,
        revieweeId: data.revieweeId,
        type: ReviewType.OWNER,
      },
    });
    if (existingOwner) {
      throw new ConflictError("You have already reviewed this owner");
    }
  }

  const row = await prisma.review.create({
    data: {
      type: data.type,
      status: ReviewStatus.PENDING,
      bookingId: data.bookingId,
      reviewerId,
      revieweeId: data.revieweeId,
      equipmentId: data.type === ReviewType.EQUIPMENT ? data.equipmentId : null,
      rating: data.rating,
      comment: data.comment?.trim() || null,
    },
    include: reviewInclude,
  });

  await notifyAfterCreate(row);
  return row;
}

/** @deprecated Use createBookingReview with type OWNER */
export async function createReview(
  reviewerId: string,
  data: {
    bookingId: string;
    revieweeId: string;
    equipmentId: string;
    rating: number;
    comment?: string;
  }
) {
  return createBookingReview(reviewerId, {
    ...data,
    type: ReviewType.OWNER,
  });
}

export async function listMyReviewsGiven(reviewerId: string) {
  return prisma.review.findMany({
    where: { reviewerId },
    include: reviewInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
