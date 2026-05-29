import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListBucketsCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
  type S3ServiceException,
} from "@aws-sdk/client-s3";
import { ExternalServiceError } from "@/lib/errors";
import { buildAllowedOrigins } from "@/lib/corsOrigins";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  STORAGE_ACCESS_KEY,
  STORAGE_ENDPOINT,
  STORAGE_PRIVATE_BUCKET,
  STORAGE_PUBLIC_BASE_URL,
  STORAGE_PUBLIC_BUCKET,
  STORAGE_REGION,
  STORAGE_SECRET_KEY,
} from "@/config/env";
import logger from "@/lib/logger";

export const PUBLIC_BUCKET = STORAGE_PUBLIC_BUCKET;
export const PRIVATE_BUCKET = STORAGE_PRIVATE_BUCKET;
export const PUBLIC_BASE = STORAGE_PUBLIC_BASE_URL;

export const s3 = new S3Client({
  region: STORAGE_REGION,
  endpoint: STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: STORAGE_ACCESS_KEY,
    secretAccessKey: STORAGE_SECRET_KEY,
  },
  forcePathStyle: true,
});

const STORAGE_AUTH_HINT =
  "Check MINIO_ACCESS_KEY and MINIO_SECRET_KEY in rental-api/.env — they must match your MinIO server (often the same as MINIO_ROOT_USER / MINIO_ROOT_PASSWORD from docker run).";

function maskAccessKey(key: string): string {
  if (key.length <= 4) {
    return "****";
  }
  return `${key.slice(0, 4)}***`;
}

export function isStorageAuthError(err: unknown): boolean {
  const name =
    err && typeof err === "object" && "name" in err && typeof err.name === "string"
      ? err.name
      : "";
  return name === "InvalidAccessKeyId" || name === "SignatureDoesNotMatch";
}

export function toStorageError(err: unknown, action: string): ExternalServiceError {
  if (isStorageAuthError(err)) {
    return new ExternalServiceError(
      "MinIO",
      `Invalid storage credentials while ${action}. ${STORAGE_AUTH_HINT}`,
      err instanceof Error ? err : undefined
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  return new ExternalServiceError(
    "MinIO",
    `Storage error while ${action}: ${message}`,
    err instanceof Error ? err : undefined
  );
}

async function verifyStorageAuth(): Promise<void> {
  try {
    await s3.send(new ListBucketsCommand({}));
    logger.info("MinIO credentials OK", {
      endpoint: STORAGE_ENDPOINT,
      accessKey: maskAccessKey(STORAGE_ACCESS_KEY),
    });
  } catch (err) {
    const s3Err = err as S3ServiceException;
    logger.error("MinIO authentication failed — uploads will not work", {
      endpoint: STORAGE_ENDPOINT,
      accessKey: maskAccessKey(STORAGE_ACCESS_KEY),
      error: s3Err.message,
      code: s3Err.name,
      hint: STORAGE_AUTH_HINT,
    });
    throw toStorageError(err, "connecting to storage");
  }
}

async function bucketExists(bucket: string): Promise<boolean> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch {
    return false;
  }
}

async function createPublicBucket(bucket: string): Promise<void> {
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  const policy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: "*",
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  });
  await s3.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: policy }));
}

async function createPrivateBucket(bucket: string): Promise<void> {
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));
}

async function configureBucketCors(bucket: string): Promise<void> {
  const origins = buildAllowedOrigins();
  if (process.env.NODE_ENV !== "production") {
    origins.push("*");
  }
  const uniqueOrigins = Array.from(new Set(origins));
  try {
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ["*"],
              AllowedMethods: ["GET", "PUT", "POST", "HEAD", "DELETE"],
              AllowedOrigins: uniqueOrigins,
              ExposeHeaders: ["ETag", "Content-Length"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      })
    );
    logger.debug("MinIO bucket CORS configured", { bucket, origins: uniqueOrigins });
  } catch (err) {
    logger.warn("MinIO bucket CORS configuration failed (browser PUT may fail)", {
      bucket,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function initStorage(): Promise<void> {
  try {
    await verifyStorageAuth();

    if (!(await bucketExists(PUBLIC_BUCKET))) {
      await createPublicBucket(PUBLIC_BUCKET);
      logger.info(`MinIO bucket created: ${PUBLIC_BUCKET} (public read)`);
    } else {
      logger.info(`MinIO bucket ready: ${PUBLIC_BUCKET}`);
    }

    if (!(await bucketExists(PRIVATE_BUCKET))) {
      await createPrivateBucket(PRIVATE_BUCKET);
      logger.info(`MinIO bucket created: ${PRIVATE_BUCKET} (private)`);
    } else {
      logger.info(`MinIO bucket ready: ${PRIVATE_BUCKET}`);
    }

    await configureBucketCors(PUBLIC_BUCKET);
    await configureBucketCors(PRIVATE_BUCKET);

    logger.info("MinIO storage initialized", { endpoint: STORAGE_ENDPOINT });
  } catch (err) {
    const detail =
      err instanceof Error
        ? { name: err.name, message: err.message, stack: err.stack }
        : { raw: String(err) };
    const meta = err && typeof err === "object" && "$metadata" in err ? (err as { $metadata?: unknown }).$metadata : undefined;
    logger.error("MinIO initialization failed", {
      ...detail,
      ...(meta ? { $metadata: meta } : {}),
      endpoint: STORAGE_ENDPOINT,
      hint:
        "Start MinIO on this host:port (e.g. docker run -p 9000:9000 minio/minio server /data). If connection fails, try MINIO_ENDPOINT=http://127.0.0.1:9000 instead of localhost (IPv6).",
    });
  }
}

export type UploadFolder = "equipment" | "avatars" | "covers" | "kyc" | "delivery" | "categories";

export function generateFileKey(folder: UploadFolder, userId: string, originalName: string): string {
  const ext = path.extname(originalName).replace(/^\./, "").toLowerCase() || "jpg";
  const safeExt = ext.replace(/[^a-z0-9]/g, "").slice(0, 8) || "jpg";
  return `${folder}/${userId}/${randomUUID()}.${safeExt}`;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  fileKey: string;
  bucket: string;
  expiresIn: number;
}

export async function generatePresignedUploadUrl(
  bucket: string,
  fileKey: string,
  contentType: string,
  expiresIn = 300
): Promise<PresignedUploadResult> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: fileKey,
    ContentType: contentType,
  });
  let uploadUrl = await getSignedUrl(s3, command, { expiresIn });
  uploadUrl = rewritePresignedUrlForBrowser(uploadUrl);
  return { uploadUrl, fileKey, bucket, expiresIn };
}

/** Optional MINIO_BROWSER_ENDPOINT — same host the browser uses (e.g. http://127.0.0.1:9000). */
function rewritePresignedUrlForBrowser(signedUrl: string): string {
  const browserBase = process.env.MINIO_BROWSER_ENDPOINT?.trim();
  if (!browserBase) {
    return signedUrl;
  }
  try {
    const signed = new URL(signedUrl);
    const browser = new URL(browserBase);
    signed.protocol = browser.protocol;
    signed.host = browser.host;
    return signed.toString();
  } catch {
    return signedUrl;
  }
}

export async function putObjectBuffer(
  bucket: string,
  fileKey: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: fileKey,
        Body: body,
        ContentType: contentType,
      })
    );
  } catch (err) {
    throw toStorageError(err, "uploading file");
  }
}

export async function generatePresignedDownloadUrl(
  bucket: string,
  fileKey: string,
  expiresIn = 3600
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: fileKey });
  return getSignedUrl(s3, command, { expiresIn });
}

export function getPublicUrl(fileKey: string): string {
  return `${PUBLIC_BASE}/${fileKey}`;
}

export async function objectExists(bucket: string, fileKey: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: fileKey }));
    return true;
  } catch {
    return false;
  }
}

export async function deleteFile(bucket: string, fileKey: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: fileKey }));
    logger.debug("Storage object deleted", { bucket, fileKey });
  } catch (err) {
    logger.warn("Failed to delete storage object", {
      bucket,
      fileKey,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export const ALLOWED_DOCUMENT_TYPES = [...ALLOWED_IMAGE_TYPES, "application/pdf"];

export function validateFileType(contentType: string, allowed: string[]): boolean {
  return allowed.includes(contentType.toLowerCase());
}

export function validateFileSize(sizeBytes: number, maxMB: number): boolean {
  return sizeBytes <= maxMB * 1024 * 1024;
}

/** Extract object key if URL was produced by getPublicUrl for this deployment. */
export function tryExtractKeyFromPublicUrl(url: string): string | null {
  const base = `${PUBLIC_BASE}/`;
  if (url.startsWith(base)) {
    return url.slice(base.length);
  }
  return null;
}
