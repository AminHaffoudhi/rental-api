import type { Request, Response } from "express";
import { UnauthorizedError } from "@/lib/errors";
import * as reviewService from "@/services/review.service";
import { success } from "@/utils/apiResponse";

export async function create(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const review = await reviewService.createReview(req.user.id, req.body);
  success(res, review, 201);
}
