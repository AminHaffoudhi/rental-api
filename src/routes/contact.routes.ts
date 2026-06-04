import { Router } from "express";
import * as contactController from "@/controllers/contact.controller";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/utils/asyncHandler";
import { contactFormSchema } from "@/validators/contact.validator";

const router = Router();

router.post("/", validate(contactFormSchema), asyncHandler(contactController.submit));

export default router;
