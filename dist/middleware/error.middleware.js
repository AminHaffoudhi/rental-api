"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = errorMiddleware;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const apiResponse_1 = require("@/utils/apiResponse");
const httpError_1 = require("@/utils/httpError");
function errorMiddleware(err, _req, res, _next) {
    if (err instanceof zod_1.ZodError) {
        return (0, apiResponse_1.error)(res, "Validation failed", 400, err.flatten());
    }
    if (err instanceof httpError_1.HttpError) {
        return (0, apiResponse_1.error)(res, err.message, err.statusCode);
    }
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
            return (0, apiResponse_1.error)(res, "A record with this value already exists", 409);
        }
        if (err.code === "P2025") {
            return (0, apiResponse_1.error)(res, "Record not found", 404);
        }
        return (0, apiResponse_1.error)(res, "Database error", 400);
    }
    if (err instanceof Error) {
        return (0, apiResponse_1.error)(res, err.message, 500);
    }
    return (0, apiResponse_1.error)(res, "Internal server error", 500);
}
