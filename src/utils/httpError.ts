import { AppError } from "@/lib/errors";

/** Legacy HTTP errors (status, message, optional machine code). */
export class HttpError extends AppError {
  constructor(statusCode: number, message: string, code?: string) {
    super(message, statusCode, code ?? "HTTP_ERROR");
    this.name = "HttpError";
  }
}
