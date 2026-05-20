import { Router } from "express";
import express from "express";
import * as uploadDirectController from "@/controllers/upload.direct.controller";
import { authMiddleware } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import { UPLOAD_MAX_DOCUMENT_MB } from "@/config/env";

const maxBytes = Math.max(UPLOAD_MAX_DOCUMENT_MB, 20) * 1024 * 1024;

const router = Router();

router.post(
  "/direct",
  authMiddleware,
  express.raw({ type: () => true, limit: maxBytes }),
  asyncHandler(uploadDirectController.directUpload)
);

export default router;
