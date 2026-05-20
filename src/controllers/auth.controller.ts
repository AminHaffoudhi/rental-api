import type { Request, Response } from "express";
import { z } from "zod";
import { UnauthorizedError } from "@/lib/errors";
import * as authService from "@/services/auth.service";
import { HttpError } from "@/utils/httpError";
import { created, success } from "@/utils/apiResponse";

export async function register(req: Request, res: Response): Promise<void> {
  const result = await authService.register(req.body);
  created(res, {
    user: result.user,
    token: result.token,
    message: result.message,
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body.email, req.body.password);
  success(res, result);
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const result = await authService.verifyEmailWithCode(req.body.code);
  success(res, result);
}

const resendGuestBodySchema = z.object({
  email: z.string().email(),
});

export async function resendCode(req: Request, res: Response): Promise<void> {
  const raw = req.body ?? {};
  const rawEmail = typeof raw.email === "string" ? raw.email.trim() : "";
  if (rawEmail) {
    const { email } = resendGuestBodySchema.parse({ email: rawEmail });
    const result = await authService.resendVerificationCodeByEmail(email);
    success(res, result);
    return;
  }
  if (!req.user) {
    throw new HttpError(400, "Provide your email or sign in to resend the code.", "RESEND_EMAIL_REQUIRED");
  }
  const result = await authService.resendVerificationCode(req.user.id);
  success(res, result);
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const user = await authService.getMe(req.user.id);
  success(res, user);
}
