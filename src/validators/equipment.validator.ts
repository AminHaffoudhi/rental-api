import { Category } from "@prisma/client";
import { z } from "zod";

export const createEquipmentSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.nativeEnum(Category),
  dailyRate: z.number().positive(),
  weeklyRate: z.number().positive().optional(),
  depositAmount: z.number().nonnegative(),
  deliveryFee: z.number().nonnegative(),
  location: z.string().min(1),
  images: z.array(z.string()).optional(),
  imageKeys: z.array(z.string()).optional(),
});

export const updateEquipmentSchema = createEquipmentSchema.partial().extend({
  isAvailable: z.boolean().optional(),
});
