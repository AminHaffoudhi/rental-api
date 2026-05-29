import { Router } from "express";
import * as reviewController from "@/controllers/review.controller";
import { authMiddleware } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import {
  createBookingReviewSchema,
  createEquipmentReviewSchema,
  createOwnerReviewSchema,
  createReviewSchema,
} from "@/validators/review.validator";

const router = Router();

router.use(authMiddleware);

router.get("/mine", asyncHandler(reviewController.listMine));
router.post("/owner", validate(createOwnerReviewSchema), asyncHandler(reviewController.createOwner));
router.post(
  "/equipment",
  validate(createEquipmentReviewSchema),
  asyncHandler(reviewController.createEquipment)
);
router.post(
  "/booking",
  validate(createBookingReviewSchema),
  asyncHandler(reviewController.createBooking)
);
router.post("/", validate(createReviewSchema), asyncHandler(reviewController.create));

export default router;
