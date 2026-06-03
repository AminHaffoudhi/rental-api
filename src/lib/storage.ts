import { Readable } from "node:stream";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { UploadApiResponse } from "cloudinary";
import { CLOUDINARY_FOLDER } from "@/config/env";
import { BusinessError, ExternalServiceError } from "@/lib/errors";
import { cloudinary } from "@/lib/cloudinary";
import logger from "@/lib/logger";

/** Sentinel values kept for API compatibility (bucket field in upload responses). */
export const PUBLIC_BUCKET = "cloudinary";
export const PRIVATE_BUCKET = "cloudinary-authenticated";

export type UploadFolder = "equipment" | "avatars" | "covers" | "kyc" | "delivery" | "categories";

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export const ALLOWED_DOCUMENT_TYPES = [...ALLOWED_IMAGE_TYPES, "application/pdf"];

function isPrivateFolder(folder: UploadFolder): boolean {
  return folder === "kyc";
}

function deliveryType(folder: UploadFolder): "authenticated" | "upload" {
  return isPrivateFolder(folder) ? "authenticated" : "upload";
}

function prefixPublicId(folder: UploadFolder, userId: string, originalName: string): string {
  const ext = path.extname(originalName).replace(/^\./, "").toLowerCase() || "jpg";
  const safeExt = ext.replace(/[^a-z0-9]/g, "").slice(0, 8) || "jpg";
  const base = CLOUDINARY_FOLDER ? `${CLOUDINARY_FOLDER}/` : "";
  return `${base}${folder}/${userId}/${randomUUID()}.${safeExt}`;
}

export function generateFileKey(folder: UploadFolder, userId: string, originalName: string): string {
  return prefixPublicId(folder, userId, originalName);
}

export function validateFileType(contentType: string, allowed: string[]): boolean {
  return allowed.includes(contentType.toLowerCase());
}

export function validateFileSize(sizeBytes: number, maxMB: number): boolean {
  return sizeBytes <= maxMB * 1024 * 1024;
}

function cloudinaryHttpCode(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const top = err as { http_code?: number; error?: { http_code?: number } };
  return top.http_code ?? top.error?.http_code;
}

export function formatCloudinaryError(err: unknown): string {
  if (err instanceof Error && err.message && err.message !== "[object Object]") {
    return err.message;
  }
  if (err && typeof err === "object") {
    const o = err as {
      message?: string;
      error?: { message?: string };
    };
    if (typeof o.message === "string" && o.message) return o.message;
    if (typeof o.error?.message === "string" && o.error.message) return o.error.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

export function isStorageAuthError(err: unknown): boolean {
  return cloudinaryHttpCode(err) === 401;
}

export function toStorageError(err: unknown, action: string): ExternalServiceError {
  const detail = formatCloudinaryError(err);
  if (isStorageAuthError(err)) {
    const hint = detail.toLowerCase().includes("cloud_name")
      ? " CLOUDINARY_CLOUD_NAME must be the exact value from Cloudinary → Dashboard → API Keys (usually lowercase, e.g. dxxxx), not your account display name."
      : "";
    return new ExternalServiceError(
      "Cloudinary",
      `Invalid Cloudinary credentials while ${action}: ${detail}.${hint}`,
      err instanceof Error ? err : undefined
    );
  }
  return new ExternalServiceError(
    "Cloudinary",
    `Storage error while ${action}: ${detail}`,
    err instanceof Error ? err : undefined
  );
}

export async function initStorage(): Promise<void> {
  try {
    await cloudinary.api.ping();
    logger.info("Cloudinary storage ready", { folder: CLOUDINARY_FOLDER || "(root)" });
  } catch (err) {
    logger.error("Cloudinary initialization failed", {
      error: formatCloudinaryError(err),
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      hint:
        "Use the exact Cloud name from Cloudinary → API Keys (not the account title). Example: CLOUDINARY_CLOUD_NAME=dxyz123abc",
    });
  }
}

function uploadBuffer(
  buffer: Buffer,
  publicId: string,
  folder: UploadFolder
): Promise<UploadApiResponse> {
  const type = deliveryType(folder);
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: "auto",
        type,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        if (!result) {
          reject(new Error("Cloudinary upload returned no result"));
          return;
        }
        resolve(result);
      }
    );
    Readable.from(buffer).pipe(stream);
  });
}

function folderFromPublicId(publicId: string): UploadFolder {
  const parts = publicId.split("/");
  const idx = CLOUDINARY_FOLDER ? 1 : 0;
  const segment = parts[idx];
  const allowed: UploadFolder[] = [
    "equipment",
    "avatars",
    "covers",
    "kyc",
    "delivery",
    "categories",
  ];
  return allowed.includes(segment as UploadFolder) ? (segment as UploadFolder) : "equipment";
}

export async function putObjectBuffer(
  _bucket: string,
  fileKey: string,
  body: Buffer,
  _contentType: string
): Promise<UploadApiResponse> {
  try {
    return await uploadBuffer(body, fileKey, folderFromPublicId(fileKey));
  } catch (err) {
    throw toStorageError(err, "uploading file");
  }
}

export function getPublicUrl(publicId: string): string {
  return cloudinary.url(publicId, {
    secure: true,
    resource_type: "auto",
    type: "upload",
  });
}

export function getAuthenticatedUrl(publicId: string, expiresInSeconds = 3600): string {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return cloudinary.url(publicId, {
    secure: true,
    resource_type: "auto",
    type: "authenticated",
    sign_url: true,
    expires_at: expiresAt,
  });
}

export async function generatePresignedDownloadUrl(
  bucket: string,
  fileKey: string,
  expiresIn = 3600
): Promise<string> {
  if (bucket !== PRIVATE_BUCKET) {
    return getPublicUrl(fileKey);
  }
  return getAuthenticatedUrl(fileKey, expiresIn);
}

export interface PresignedUploadResult {
  uploadUrl: string;
  fileKey: string;
  bucket: string;
  expiresIn: number;
}

/** @deprecated Use POST /api/upload/direct — Cloudinary uses multipart POST, not S3 PUT. */
export async function generatePresignedUploadUrl(
  _bucket: string,
  _fileKey: string,
  _contentType: string,
  _expiresIn = 300
): Promise<PresignedUploadResult> {
  throw new BusinessError("Use POST /api/upload/direct for file uploads.");
}

export async function objectExists(bucket: string, fileKey: string): Promise<boolean> {
  const type = bucket === PRIVATE_BUCKET ? "authenticated" : "upload";
  try {
    await cloudinary.api.resource(fileKey, { resource_type: "auto", type });
    return true;
  } catch (err) {
    const httpCode =
      err && typeof err === "object" && "error" in err
        ? (err as { error?: { http_code?: number } }).error?.http_code
        : undefined;
    if (httpCode === 404) {
      return false;
    }
    throw toStorageError(err, "checking file");
  }
}

export async function deleteFile(_bucket: string, fileKey: string): Promise<void> {
  const isKyc = fileKey.includes("/kyc/");
  try {
    await cloudinary.uploader.destroy(fileKey, {
      resource_type: "auto",
      type: isKyc ? "authenticated" : "upload",
      invalidate: true,
    });
    logger.debug("Cloudinary asset deleted", { publicId: fileKey });
  } catch (err) {
    logger.warn("Failed to delete Cloudinary asset", {
      publicId: fileKey,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Extract public_id from a Cloudinary delivery URL. */
export function tryExtractKeyFromPublicUrl(url: string): string | null {
  if (!url.includes("res.cloudinary.com")) {
    return null;
  }
  const match = url.match(/\/upload\/(?:[^/]+\/)*(?:v\d+\/)?([^?]+)/);
  if (!match?.[1]) {
    return null;
  }
  return decodeURIComponent(match[1]);
}
