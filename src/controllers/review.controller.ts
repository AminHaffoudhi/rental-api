import type { Request, Response } from "express";
import { ReviewType } from "@prisma/client";
import * as reviewService from "@/services/review.service";
import { success } from "@/utils/apiResponse";

export async function createOwner(req: Request, res: Response): Promise<void> {
  const review = await reviewService.createOwnerReview(req.user!.id, req.body);
  success(res, review, 201);
}

export async function createEquipment(req: Request, res: Response): Promise<void> {
  const review = await reviewService.createEquipmentReview(req.user!.id, req.body);
  success(res, review, 201);
}

export async function createBooking(req: Request, res: Response): Promise<void> {
  const review = await reviewService.createBookingReview(req.user!.id, {
    ...req.body,
    type: req.body.type as ReviewType,
  });
  success(res, review, 201);
}

export async function create(req: Request, res: Response): Promise<void> {
  const review = await reviewService.createReview(req.user!.id, req.body);
  success(res, review, 201);
}

export async function listMine(req: Request, res: Response): Promise<void> {
  const reviews = await reviewService.listMyReviewsGiven(req.user!.id);
  success(res, reviews);
}
