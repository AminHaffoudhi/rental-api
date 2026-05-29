import type { Request, Response } from "express";
import * as categoryService from "@/services/category.service";
import { success } from "@/utils/apiResponse";

export async function list(_req: Request, res: Response): Promise<void> {
  const items = await categoryService.listActiveCategories();
  success(res, items);
}
