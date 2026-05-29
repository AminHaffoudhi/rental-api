import { Router } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import * as categoryController from "@/controllers/category.controller";

const router = Router();

router.get("/", asyncHandler(categoryController.list));

export default router;
