import { Router } from "express";
import * as authController from "@/controllers/auth.controller";
import { authMiddleware } from "@/middleware/auth.middleware";
import { optionalAuthMiddleware } from "@/middleware/optionalAuth.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import {
  loginSchema,
  registerSchema,
  verifyEmailCodeSchema,
} from "@/validators/auth.validator";

const router = Router();

router.post("/register", validate(registerSchema), asyncHandler(authController.register));
router.post("/login", validate(loginSchema), asyncHandler(authController.login));
router.post(
  "/verify-email",
  validate(verifyEmailCodeSchema),
  asyncHandler(authController.verifyEmail)
);
router.post("/resend-code", optionalAuthMiddleware, asyncHandler(authController.resendCode));
router.get("/me", authMiddleware, asyncHandler(authController.me));

export default router;
