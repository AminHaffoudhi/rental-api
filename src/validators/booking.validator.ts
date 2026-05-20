import { z } from "zod";

export const createBookingSchema = z.object({
  equipmentId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  notes: z.string().optional(),
});

export const rejectBookingSchema = z.object({
  reason: z.string().optional(),
});

export const raiseDisputeSchema = z.object({
  reason: z.string().min(1),
  evidence: z.array(z.string().url()).optional(),
});
