import { Router } from "express";
import assistantRoutes from "@/routes/assistant.routes";
import authRoutes from "@/routes/auth.routes";
import bookingRoutes from "@/routes/booking.routes";
import categoryRoutes from "@/routes/category.routes";
import contactRoutes from "@/routes/contact.routes";
import deliveryRoutes from "@/routes/delivery.routes";
import equipmentRoutes from "@/routes/equipment.routes";
import kycRoutes from "@/routes/kyc.routes";
import notificationsRoutes from "@/routes/notifications.routes";
import ownerRoutes from "@/routes/owner.routes";
import paymentRoutes from "@/routes/payment.routes";
import reviewRoutes from "@/routes/review.routes";
import uploadRoutes from "@/routes/upload.routes";
import userRoutes from "@/routes/user.routes";

const router = Router();

router.use("/assistant", assistantRoutes);
router.use("/auth", authRoutes);
router.use("/categories", categoryRoutes);
router.use("/contact", contactRoutes);
router.use("/kyc", kycRoutes);
router.use("/users", userRoutes);
router.use("/equipment", equipmentRoutes);
router.use("/bookings", bookingRoutes);
router.use("/delivery", deliveryRoutes);
router.use("/payments", paymentRoutes);
router.use("/reviews", reviewRoutes);
router.use("/upload", uploadRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/owner", ownerRoutes);

export default router;
