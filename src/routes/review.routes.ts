import { Router } from "express";
import * as reviewController from "@/controllers/review.controller";
import { authMiddleware } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import { createReviewSchema } from "@/validators/review.validator";

const router = Router();

router.use(authMiddleware);

router.post("/", validate(createReviewSchema), asyncHandler(reviewController.create));

export default router;
