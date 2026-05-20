import { z } from "zod";

export const kycSubmitSchema = z.object({
  documentUrl: z.string().url(),
  documentType: z.enum(["national_id", "passport", "driving_license"]),
});
