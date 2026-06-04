import { Router } from "express";
import * as ownerDashboardController from "@/controllers/ownerDashboard.controller";
import { authMiddleware } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";

const router = Router();

router.use(authMiddleware);

router.get("/dashboard", asyncHandler(ownerDashboardController.getDashboard));

export default router;
