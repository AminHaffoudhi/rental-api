import { Router } from "express";
import * as uploadController from "@/controllers/upload.controller";
import { authMiddleware } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import {
  confirmUploadSchema,
  signUploadSchema,
  uploadPresignSchema,
} from "@/validators/upload.validator";

const router = Router();

router.use(authMiddleware);

router.post("/sign", validate(signUploadSchema), asyncHandler(uploadController.signUpload));
router.post("/confirm", validate(confirmUploadSchema), asyncHandler(uploadController.confirmUpload));
router.get("/private", asyncHandler(uploadController.getPrivateUrl));
router.post("/presign", validate(uploadPresignSchema), asyncHandler(uploadController.presign));

export default router;
