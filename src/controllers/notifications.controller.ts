import type { Request, Response } from "express";
import { UnauthorizedError } from "@/lib/errors";
import * as userNotificationsService from "@/services/userNotifications.service";
import { success } from "@/utils/apiResponse";

export async function list(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const notifications = await userNotificationsService.listForUser(req.user.id);
  success(res, notifications);
}
