import { Router } from "express";
import * as userController from "@/controllers/user.controller";
import { authMiddleware } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import { oneSignalPlayerIdSchema, updateUserSchema, uploadKycSchema } from "@/validators/user.validator";

const router = Router();

router.put("/me", authMiddleware, validate(updateUserSchema), asyncHandler(userController.updateMe));
router.post(
  "/me/onesignal-id",
  authMiddleware,
  validate(oneSignalPlayerIdSchema),
  asyncHandler(userController.setOneSignalPlayerId)
);
router.post(
  "/me/kyc",
  authMiddleware,
  validate(uploadKycSchema),
  asyncHandler(userController.uploadKyc)
);
router.get("/:id", asyncHandler(userController.getById));

export default router;
