import { Router } from "express";
import * as bookingController from "@/controllers/booking.controller";
import { authMiddleware } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import {
  createBookingSchema,
  raiseDisputeSchema,
  rejectBookingSchema,
} from "@/validators/booking.validator";

const router = Router();

router.use(authMiddleware);

router.get("/", asyncHandler(bookingController.listMine));
router.post("/", validate(createBookingSchema), asyncHandler(bookingController.create));
router.get("/:id", asyncHandler(bookingController.getById));
router.post("/:id/approve", asyncHandler(bookingController.approve));
router.post(
  "/:id/reject",
  validate(rejectBookingSchema),
  asyncHandler(bookingController.reject)
);
router.post("/:id/cancel", asyncHandler(bookingController.cancel));
router.post("/:id/confirm-delivery", asyncHandler(bookingController.confirmDelivery));
router.post("/:id/owner-handover", asyncHandler(bookingController.ownerHandover));
router.post("/:id/owner-complete-return", asyncHandler(bookingController.ownerCompleteReturn));
router.post("/:id/complete", asyncHandler(bookingController.completeRental));
router.post("/:id/return-request", asyncHandler(bookingController.requestReturn));
router.post("/:id/dispute", validate(raiseDisputeSchema), asyncHandler(bookingController.dispute));

export default router;
