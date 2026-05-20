import { z } from "zod";

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  image: z.string().url().optional(),
});

export const uploadKycSchema = z.object({
  documentUrl: z.string().url(),
  documentType: z.enum(["national_id", "passport", "driving_license"]).optional(),
});

export const oneSignalPlayerIdSchema = z.object({
  playerId: z.string().min(1).max(500),
});
