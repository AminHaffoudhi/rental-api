import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { requestContext } from "@/lib/requestContext";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = (typeof req.headers["x-request-id"] === "string" && req.headers["x-request-id"].trim()) || randomUUID();
  req.requestId = id;
  res.requestId = id;
  res.setHeader("X-Request-Id", id);
  requestContext.run({ requestId: id }, () => next());
}
