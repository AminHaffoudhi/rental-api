import type { Request, Response } from "express";
import { UnauthorizedError } from "@/lib/errors";
import * as kycService from "@/services/kyc.service";
import { success } from "@/utils/apiResponse";

export async function submit(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const body = req.body as { documentUrl: string; documentType: string };
  await kycService.submitKyc(req.user.id, body.documentUrl, body.documentType);
  success(res, { message: "KYC submitted for review." });
}

export async function status(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const data = await kycService.getKycStatus(req.user.id);
  success(res, data);
}
