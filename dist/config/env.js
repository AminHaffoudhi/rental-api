"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UPSTASH_REDIS_REST_TOKEN = exports.UPSTASH_REDIS_REST_URL = exports.RESEND_API_KEY = exports.CLOUDINARY_API_SECRET = exports.CLOUDINARY_API_KEY = exports.CLOUDINARY_CLOUD_NAME = exports.CLIENT_URL = exports.PORT = exports.JWT_EXPIRES_IN = exports.JWT_SECRET = exports.DIRECT_URL = exports.DATABASE_URL = void 0;
require("dotenv/config");
function requireNonEmpty(name, value) {
    if (value === undefined || value.trim() === "") {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
exports.DATABASE_URL = requireNonEmpty("DATABASE_URL", process.env.DATABASE_URL);
exports.DIRECT_URL = requireNonEmpty("DIRECT_URL", process.env.DIRECT_URL);
exports.JWT_SECRET = requireNonEmpty("JWT_SECRET", process.env.JWT_SECRET);
exports.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";
const portRaw = requireNonEmpty("PORT", process.env.PORT ?? "4000");
const parsedPort = Number.parseInt(portRaw, 10);
if (Number.isNaN(parsedPort)) {
    throw new Error("PORT must be a valid number");
}
exports.PORT = parsedPort;
exports.CLIENT_URL = requireNonEmpty("CLIENT_URL", process.env.CLIENT_URL);
exports.CLOUDINARY_CLOUD_NAME = requireNonEmpty("CLOUDINARY_CLOUD_NAME", process.env.CLOUDINARY_CLOUD_NAME);
exports.CLOUDINARY_API_KEY = requireNonEmpty("CLOUDINARY_API_KEY", process.env.CLOUDINARY_API_KEY);
exports.CLOUDINARY_API_SECRET = requireNonEmpty("CLOUDINARY_API_SECRET", process.env.CLOUDINARY_API_SECRET);
exports.RESEND_API_KEY = requireNonEmpty("RESEND_API_KEY", process.env.RESEND_API_KEY);
exports.UPSTASH_REDIS_REST_URL = requireNonEmpty("UPSTASH_REDIS_REST_URL", process.env.UPSTASH_REDIS_REST_URL);
exports.UPSTASH_REDIS_REST_TOKEN = requireNonEmpty("UPSTASH_REDIS_REST_TOKEN", process.env.UPSTASH_REDIS_REST_TOKEN);
