import type { NextFunction, Request, Response } from "express";
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from "@prisma/client/runtime/library";
import * as Sentry from "@sentry/node";
import { StatusCodes } from "http-status-codes";
import { ZodError } from "zod";
import { isAppError } from "@/lib/errors";
import { isStorageAuthError } from "@/lib/storage";
import logger from "@/lib/logger";

function zodIssuesToFields(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_root";
    fields[key] = issue.message;
  }
  return fields;
}

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId;

  if (err instanceof ZodError) {
    const fields = zodIssuesToFields(err);
    logger.warn("Validation failed", { requestId, url: req.originalUrl, fields });
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid input. Please check the highlighted fields.",
      fields,
      requestId,
    });
    return;
  }

  if (err instanceof PrismaClientInitializationError) {
    logger.error("Prisma initialization error", { requestId, message: err.message });
    res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      success: false,
      code: "DATABASE_UNAVAILABLE",
      message:
        "Database is unavailable or access was denied. Check DATABASE_URL, that PostgreSQL is running, and that the user can connect to the database.",
      requestId,
    });
    return;
  }

  if (err instanceof PrismaClientKnownRequestError) {
    logger.warn("Prisma known error", { requestId, code: err.code, meta: err.meta });

    switch (err.code) {
      case "P2002": {
        const field = Array.isArray(err.meta?.target) ? (err.meta?.target as string[]).join(", ") : "field";
        res.status(StatusCodes.CONFLICT).json({
          success: false,
          code: "CONFLICT",
          message: `A record with this ${field} already exists.`,
          requestId,
        });
        return;
      }
      case "P2025": {
        res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          code: "NOT_FOUND",
          message: "The requested record does not exist.",
          requestId,
        });
        return;
      }
      case "P2003": {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          code: "INVALID_REFERENCE",
          message: "Referenced record does not exist.",
          requestId,
        });
        return;
      }
      case "P2021": {
        res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
          success: false,
          code: "SCHEMA_NOT_APPLIED",
          message: "Database tables are missing. From rental-api run: npx prisma db push",
          requestId,
        });
        return;
      }
      case "P1010": {
        res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
          success: false,
          code: "DATABASE_UNAVAILABLE",
          message:
            "Database access denied. Check DATABASE_URL (user, password, host, port) and that the database exists.",
          requestId,
        });
        return;
      }
      default: {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          success: false,
          code: "DATABASE_ERROR",
          message: "A database error occurred.",
          requestId,
        });
        return;
      }
    }
  }

  if (err instanceof PrismaClientValidationError) {
    logger.error("Prisma validation error", { requestId, message: err.message });
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      code: "DATABASE_VALIDATION_ERROR",
      message: "Invalid data sent to database.",
      requestId,
    });
    return;
  }

  if (isStorageAuthError(err)) {
    logger.warn("Storage authentication failed", {
      requestId,
      url: req.originalUrl,
      message: err instanceof Error ? err.message : String(err),
    });
    res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      success: false,
      code: "STORAGE_AUTH_FAILED",
      message:
        process.env.NODE_ENV === "production"
          ? "File storage is temporarily unavailable."
          : "MinIO credentials are wrong. Set MINIO_ACCESS_KEY and MINIO_SECRET_KEY in rental-api/.env to match your MinIO login (docker: MINIO_ROOT_USER / MINIO_ROOT_PASSWORD).",
      requestId,
    });
    return;
  }

  if (isAppError(err)) {
    const logMeta = {
      requestId,
      code: err.code,
      statusCode: err.statusCode,
      url: req.originalUrl,
      method: req.method,
      context: err.context,
      ...(err.statusCode >= 500 ? { stack: err.stack } : {}),
    };

    if (err.statusCode >= 500) logger.error(err.message, logMeta);
    else if (err.statusCode >= 400) logger.warn(err.message, logMeta);

    const body: Record<string, unknown> = {
      success: false,
      code: err.code,
      message: err.message,
      requestId,
    };

    if ("fields" in err && err.fields) body.fields = err.fields;
    if (process.env.NODE_ENV !== "production") {
      body.context = err.context;
      body.stack = err.stack;
    }

    res.status(err.statusCode).json(body);
    return;
  }

  if (err instanceof Error && err.name === "JsonWebTokenError") {
    logger.warn("Invalid JWT", { requestId });
    res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      code: "INVALID_TOKEN",
      message: "Your session is invalid. Please log in again.",
      requestId,
    });
    return;
  }

  if (err instanceof Error && err.name === "TokenExpiredError") {
    logger.warn("Expired JWT", { requestId });
    res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      code: "TOKEN_EXPIRED",
      message: "Your session has expired. Please log in again.",
      requestId,
    });
    return;
  }

  const unknownErr = err instanceof Error ? err : new Error(String(err));

  logger.error("Unhandled error", {
    requestId,
    url: req.originalUrl,
    method: req.method,
    message: unknownErr.message,
    stack: unknownErr.stack,
  });

  if (process.env.SENTRY_DSN) {
    Sentry.captureException(unknownErr);
  }

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    code: "INTERNAL_ERROR",
    message:
      process.env.NODE_ENV === "production"
        ? "Something went wrong. Our team has been notified."
        : unknownErr.message,
    requestId,
    ...(process.env.NODE_ENV !== "production" ? { stack: unknownErr.stack } : {}),
  });
}
