import type { Request, Response } from "express";
import { Role } from "@prisma/client";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import * as ownerDashboardService from "@/services/ownerDashboard.service";
import { success } from "@/utils/apiResponse";

export async function getDashboard(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  const role = req.user.role;
  if (role !== Role.OWNER && role !== Role.BOTH && role !== Role.ADMIN) {
    throw new ForbiddenError("Owner dashboard is only available for equipment owners");
  }

  const data = await ownerDashboardService.getOwnerDashboard(req.user.id);
  success(res, data);
}
