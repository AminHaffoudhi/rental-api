import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "@/lib/errors";

export function requireCanList(req: Request, _res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user) {
    next(new ForbiddenError());
    return;
  }
  if (user.role === "RENTER") {
    next(
      new ForbiddenError("Renters cannot create equipment listings.")
    );
    return;
  }
  if (!user.canList) {
    next(
      new ForbiddenError(
        "Your identity has not been verified yet. Please upload your ID document and wait for admin approval."
      )
    );
    return;
  }
  next();
}
