import { Router } from "express";
import * as equipmentController from "@/controllers/equipment.controller";
import { authMiddleware } from "@/middleware/auth.middleware";
import { requireCanList } from "@/middleware/canList.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import {
  createEquipmentSchema,
  updateEquipmentSchema,
} from "@/validators/equipment.validator";

const router = Router();

router.get("/", asyncHandler(equipmentController.search));
router.post(
  "/",
  authMiddleware,
  requireCanList,
  validate(createEquipmentSchema),
  asyncHandler(equipmentController.create)
);
router.get("/:id/availability", asyncHandler(equipmentController.availability));
router.get("/:id", asyncHandler(equipmentController.getById));
router.put(
  "/:id",
  authMiddleware,
  validate(updateEquipmentSchema),
  asyncHandler(equipmentController.update)
);
router.delete("/:id", authMiddleware, asyncHandler(equipmentController.remove));

export default router;
