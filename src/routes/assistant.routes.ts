import { Router } from "express";
import * as assistantController from "@/controllers/assistant.controller";
import { authMiddleware } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import { assistantChatSchema } from "@/validators/assistant.validator";

const router = Router();

router.get("/status", asyncHandler(assistantController.getStatus));

router.use(authMiddleware);

router.post(
  "/renter",
  validate(assistantChatSchema),
  asyncHandler(assistantController.renterChat)
);

router.post(
  "/owner",
  validate(assistantChatSchema),
  asyncHandler(assistantController.ownerChat)
);

router.get("/owner/suggestions", asyncHandler(assistantController.ownerSuggestions));

export default router;
