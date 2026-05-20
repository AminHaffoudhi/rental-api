import type { Response } from "express";
import { StatusCodes } from "http-status-codes";
import { requestContext } from "@/lib/requestContext";
import type { ApiSuccess } from "@/types/api";

function requestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

export function success<T>(
  res: Response,
  data: T,
  statusCode: number = StatusCodes.OK,
  meta?: { page?: number; total?: number; perPage?: number }
): Response<ApiSuccess<T> & { meta?: typeof meta; requestId?: string }> {
  const body: Record<string, unknown> = { success: true, data };
  if (meta) body.meta = meta;
  const rid = requestId();
  if (rid) body.requestId = rid;
  return res.status(statusCode).json(body) as Response<ApiSuccess<T>>;
}

export function created<T>(res: Response, data: T): Response {
  return success(res, data, StatusCodes.CREATED);
}

export function noContent(res: Response): Response {
  return res.status(StatusCodes.NO_CONTENT).send();
}

export function paginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  perPage: number
): Response {
  return success(res, data, StatusCodes.OK, { total, page, perPage });
}

export function error(
  res: Response,
  message: string,
  statusCode: number = StatusCodes.BAD_REQUEST,
  errors?: unknown,
  code?: string
): Response {
  const rid = requestId();
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors !== undefined ? { errors } : {}),
    ...(code !== undefined ? { code } : {}),
    ...(rid ? { requestId: rid } : {}),
  });
}
