import type { NextFunction, Request, Response } from "express";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/utils/jwt";

/** Attaches `req.user` when a valid Bearer token is present; otherwise continues without error. */
export async function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next();
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    next();
    return;
  }
  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (user) {
      req.user = {
        id: user.id,
        role: user.role,
        email: user.email,
        canList: user.canList,
      };
    }
  } catch {
    /* invalid/expired token — treat as anonymous */
  }
  next();
}
