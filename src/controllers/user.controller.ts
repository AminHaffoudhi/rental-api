import type { Request, Response } from "express";
import { UnauthorizedError } from "@/lib/errors";
import * as authService from "@/services/auth.service";
import * as kycService from "@/services/kyc.service";
import * as userService from "@/services/user.service";
import { success } from "@/utils/apiResponse";
import { pathParam } from "@/utils/pathParam";

export async function getById(req: Request, res: Response): Promise<void> {
  const profile = await userService.getUserById(pathParam(req.params.id));
  success(res, profile);
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const user = await userService.updateUser(req.user.id, req.body);
  success(res, user);
}

export async function setOneSignalPlayerId(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const user = await userService.setOneSignalPlayerId(req.user.id, req.body.playerId);
  success(res, user);
}

export async function uploadKyc(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const documentType = (req.body.documentType as string | undefined) ?? "national_id";
  await kycService.submitKyc(req.user.id, req.body.documentUrl, documentType);
  const user = await authService.getMe(req.user.id);
  success(res, user);
}
