import type { Request, Response } from "express";
import { UnauthorizedError } from "@/lib/errors";
import * as assistantService from "@/services/assistant.service";
import { success } from "@/utils/apiResponse";

export async function renterChat(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const reply = await assistantService.chatRenter(req.user.id, req.body);
  success(res, { reply });
}

export async function ownerChat(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const reply = await assistantService.chatOwner(req.user.id, req.user.role, req.body);
  success(res, { reply });
}

export async function ownerSuggestions(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const suggestions = await assistantService.getOwnerSuggestions(req.user.id, req.user.role);
  success(res, { suggestions });
}

export async function getStatus(_req: Request, res: Response): Promise<void> {
  success(res, assistantService.assistantStatus());
}
