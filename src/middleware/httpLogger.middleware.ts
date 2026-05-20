import type { NextFunction, Request, Response } from "express";
import logger from "@/lib/logger";

export function httpLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startAt = process.hrtime.bigint();

  res.on("finish", () => {
    const elapsedMs = Number(process.hrtime.bigint() - startAt) / 1e6;
    const ms = elapsedMs.toFixed(2);
    const status = res.statusCode;

    const meta = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      status,
      ms: `${ms}ms`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      userId: req.user?.id,
    };

    const msg = `${req.method} ${req.originalUrl} ${status} ${ms}ms`;

    if (status >= 500) logger.error(msg, meta);
    else if (status >= 400) logger.warn(msg, meta);
    else logger.http(msg, meta);
  });

  next();
}
