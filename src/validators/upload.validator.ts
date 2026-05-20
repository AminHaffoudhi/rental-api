import { z } from "zod";

export const signUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1),
  fileSize: z.number().positive(),
  folder: z.enum(["equipment", "avatars", "kyc", "delivery"]),
});

export type SignUploadInput = z.infer<typeof signUploadSchema>;

export const confirmUploadSchema = z.object({
  fileKey: z.string().min(1),
  bucket: z.string().min(1),
});

export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

export const uploadPresignSchema = z.object({
  folder: z.string().optional(),
  contentType: z.string().min(1, "contentType is required"),
  filename: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.coerce.number().positive().optional(),
});

export type UploadPresignInput = z.infer<typeof uploadPresignSchema>;
