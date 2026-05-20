import { Router } from "express";
import * as deliveryController from "@/controllers/delivery.controller";
import { authMiddleware } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";

const router = Router();

router.use(authMiddleware);

router.get("/:id", asyncHandler(deliveryController.getOne));
router.post("/:id/pickup-photos", asyncHandler(deliveryController.pickupPhotos));
router.post("/:id/return-photos", asyncHandler(deliveryController.returnPhotos));

export default router;
