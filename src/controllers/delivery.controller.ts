import type { Request, Response } from "express";
import { z } from "zod";
import { UnauthorizedError } from "@/lib/errors";
import * as deliveryService from "@/services/delivery.service";
import { success } from "@/utils/apiResponse";
import { pathParam } from "@/utils/pathParam";

const photosBodySchema = z.object({
  photos: z.array(z.string().min(1)),
});

export async function getOne(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const delivery = await deliveryService.getDelivery(pathParam(req.params.id), req.user.id);
  success(res, delivery);
}

export async function pickupPhotos(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const body = photosBodySchema.parse(req.body);
  const delivery = await deliveryService.uploadPickupPhotos(
    pathParam(req.params.id),
    body.photos,
    req.user.id
  );
  success(res, delivery);
}

export async function returnPhotos(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const body = photosBodySchema.parse(req.body);
  const delivery = await deliveryService.uploadReturnPhotos(
    pathParam(req.params.id),
    body.photos,
    req.user.id
  );
  success(res, delivery);
}
