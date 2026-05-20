import { Router } from "express";
import * as paymentController from "@/controllers/payment.controller";
import { authMiddleware } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/asyncHandler";

const router = Router();

router.use(authMiddleware);

router.get("/booking/:bookingId", asyncHandler(paymentController.getByBooking));

export default router;
