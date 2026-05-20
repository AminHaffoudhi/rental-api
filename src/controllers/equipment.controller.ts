import { Category } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import { UnauthorizedError } from "@/lib/errors";
import * as equipmentService from "@/services/equipment.service";
import { success } from "@/utils/apiResponse";
import { pathParam } from "@/utils/pathParam";

const searchQuerySchema = z.object({
  q: z.string().optional(),
  category: z.nativeEnum(Category).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  location: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.enum(["recent", "price_asc", "price_desc", "rating"]).optional(),
  availableOnly: z.union([z.literal("true"), z.literal("false")]).optional(),
});

export async function search(req: Request, res: Response): Promise<void> {
  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw parsed.error;
  }
  const { availableOnly, ...rest } = parsed.data;
  const items = await equipmentService.searchEquipment({
    ...rest,
    ...(availableOnly !== undefined
      ? { availableOnly: availableOnly === "true" }
      : {}),
  });
  success(res, items);
}

export async function create(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const item = await equipmentService.createEquipment(req.user.id, req.body);
  success(res, item, 201);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const item = await equipmentService.getEquipmentById(pathParam(req.params.id));
  success(res, item);
}

export async function update(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const item = await equipmentService.updateEquipment(pathParam(req.params.id), req.user.id, req.body);
  success(res, item);
}

export async function remove(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  await equipmentService.deleteEquipment(pathParam(req.params.id), req.user.id);
  success(res, { ok: true });
}

export async function availability(req: Request, res: Response): Promise<void> {
  const month = typeof req.query.month === "string" ? req.query.month : "";
  const data = await equipmentService.getAvailability(pathParam(req.params.id), month);
  success(res, data);
}
