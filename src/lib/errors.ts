import { StatusCodes } from "http-status-codes";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    code: string = "INTERNAL_ERROR",
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public readonly fields?: Record<string, string>;
  constructor(message: string, fields?: Record<string, string>) {
    super(message, StatusCodes.BAD_REQUEST, "VALIDATION_ERROR", fields ? { fields } : undefined);
    this.fields = fields;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, StatusCodes.UNAUTHORIZED, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, StatusCodes.FORBIDDEN, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, StatusCodes.NOT_FOUND, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, StatusCodes.CONFLICT, "CONFLICT");
  }
}

export class BusinessError extends AppError {
  constructor(message: string, code = "BUSINESS_RULE_VIOLATION", context?: Record<string, unknown>) {
    super(message, StatusCodes.UNPROCESSABLE_ENTITY, code, context);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Please slow down.") {
    super(message, StatusCodes.TOO_MANY_REQUESTS, "RATE_LIMIT");
  }
}

export class ExternalServiceError extends AppError {
  public readonly service: string;
  public readonly originalError?: Error;
  constructor(service: string, message: string, originalError?: Error) {
    super(
      `External service error (${service}): ${message}`,
      StatusCodes.SERVICE_UNAVAILABLE,
      "EXTERNAL_SERVICE_ERROR",
      { service }
    );
    this.service = service;
    this.originalError = originalError;
  }
}

export class InvalidTransitionError extends BusinessError {
  constructor(from: string, to: string) {
    super(
      `Cannot transition booking from ${from} to ${to}`,
      "INVALID_BOOKING_TRANSITION",
      { from, to }
    );
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export function isOperationalError(err: unknown): boolean {
  return isAppError(err) && err.isOperational;
}
