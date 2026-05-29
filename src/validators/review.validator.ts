import { z } from "zod";

const rating = z.number().int().min(1).max(5);
const comment = z.string().trim().max(1000).optional();

export const createOwnerReviewSchema = z.object({
  revieweeId: z.string().min(1),
  rating,
  comment,
});

export const createEquipmentReviewSchema = z.object({
  equipmentId: z.string().min(1),
  rating,
  comment,
});

export const createBookingReviewSchema = z.object({
  bookingId: z.string().min(1),
  revieweeId: z.string().min(1),
  equipmentId: z.string().min(1),
  type: z.enum(["OWNER", "EQUIPMENT"]),
  rating,
  comment,
});

export const createReviewSchema = z.object({
  bookingId: z.string().min(1),
  revieweeId: z.string().min(1),
  equipmentId: z.string().min(1),
  rating,
  comment,
});
