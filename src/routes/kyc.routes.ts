import { Router } from "express";
import * as kycController from "@/controllers/kyc.controller";
import { authMiddleware } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import { kycSubmitSchema } from "@/validators/kyc.validator";

const router = Router();

router.post(
  "/submit",
  authMiddleware,
  validate(kycSubmitSchema),
  asyncHandler(kycController.submit)
);
router.get("/status", authMiddleware, asyncHandler(kycController.status));

export default router;
