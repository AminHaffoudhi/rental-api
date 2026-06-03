import dotenv from "dotenv";

dotenv.config({ override: true });

function requireNonEmpty(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const DATABASE_URL = requireNonEmpty("DATABASE_URL", process.env.DATABASE_URL);
export const JWT_SECRET = requireNonEmpty("JWT_SECRET", process.env.JWT_SECRET);
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";

const portRaw = requireNonEmpty("PORT", process.env.PORT ?? "4000");
const parsedPort = Number.parseInt(portRaw, 10);
if (Number.isNaN(parsedPort)) {
  throw new Error("PORT must be a valid number");
}
export const PORT = parsedPort;

export const CLIENT_URL = requireNonEmpty("CLIENT_URL", process.env.CLIENT_URL);

/** Admin panel URL (emails to admins). Falls back to CLIENT_URL then localhost. */
export const ADMIN_CLIENT_URL = (
  process.env.ADMIN_CLIENT_URL?.trim() ||
  process.env.CLIENT_URL?.trim() ||
  "http://localhost:5175"
).replace(/\/+$/, "");

export const CLOUDINARY_CLOUD_NAME = requireNonEmpty(
  "CLOUDINARY_CLOUD_NAME",
  process.env.CLOUDINARY_CLOUD_NAME
);

export const CLOUDINARY_API_KEY = requireNonEmpty(
  "CLOUDINARY_API_KEY",
  process.env.CLOUDINARY_API_KEY
);

export const CLOUDINARY_API_SECRET = requireNonEmpty(
  "CLOUDINARY_API_SECRET",
  process.env.CLOUDINARY_API_SECRET
);

/** Optional root folder prefix for all uploads (e.g. rentmarket). */
export const CLOUDINARY_FOLDER = (process.env.CLOUDINARY_FOLDER?.trim() || "rentmarket").replace(
  /\/+$/,
  ""
);

/** Absolute base for this API (private document proxy URLs). Defaults to http://localhost:{PORT} */
export const API_PUBLIC_URL = (
  process.env.API_PUBLIC_URL?.trim() || `http://127.0.0.1:${PORT}`
).replace(/\/+$/, "");

export const UPLOAD_MAX_IMAGE_MB = Number(process.env.UPLOAD_MAX_IMAGE_MB) || 10;
export const UPLOAD_MAX_DOCUMENT_MB = Number(process.env.UPLOAD_MAX_DOCUMENT_MB) || 20;

/** Local Redis (ioredis). Defaults: 127.0.0.1:6379 */
export const REDIS_HOST = process.env.REDIS_HOST?.trim() || "127.0.0.1";
export const REDIS_PORT = process.env.REDIS_PORT?.trim() || "6379";

/** Stripe secret key — unset disables online checkout (manual admin confirm only). */
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim() || "";
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
/** ISO currency for Checkout (Stripe does not support TND; use eur or usd in test). */
export const STRIPE_CURRENCY = (process.env.STRIPE_CURRENCY?.trim() || "eur").toLowerCase();

export function isStripeConfigured(): boolean {
  return STRIPE_SECRET_KEY.length > 0;
}
