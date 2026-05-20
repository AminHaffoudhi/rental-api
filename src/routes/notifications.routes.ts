import { Router } from "express";
import * as notificationsController from "@/controllers/notifications.controller";
import { authMiddleware } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";

const router = Router();

router.use(authMiddleware);
router.get("/", asyncHandler(notificationsController.list));

export default router;
