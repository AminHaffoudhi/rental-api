import type { NextFunction, Request, Response } from "express";
import { prisma } from "@/lib/prisma";
import { UnauthorizedError } from "@/lib/errors";
import { verifyToken } from "@/utils/jwt";

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new UnauthorizedError("Missing or invalid authorization header"));
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    next(new UnauthorizedError());
    return;
  }

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) {
      next(new UnauthorizedError());
      return;
    }
    req.user = {
      id: user.id,
      role: user.role,
      email: user.email,
      canList: user.canList,
    };
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired token"));
  }
}
