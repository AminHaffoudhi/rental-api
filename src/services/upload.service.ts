import {
  UPLOAD_MAX_DOCUMENT_MB,
  UPLOAD_MAX_IMAGE_MB,
} from "@/config/env";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import logger from "@/lib/logger";
import {
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_IMAGE_TYPES,
  generateFileKey,
  generatePresignedDownloadUrl,
  generatePresignedUploadUrl,
  getPublicUrl,
  objectExists,
  PRIVATE_BUCKET,
  PUBLIC_BUCKET,
  putObjectBuffer,
  type UploadFolder,
  validateFileSize,
  validateFileType,
} from "@/lib/storage";

export interface SignUploadRequest {
  fileName: string;
  contentType: string;
  fileSize: number;
  folder: UploadFolder;
  userId: string;
}

export interface SignUploadResponse {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string | null;
  bucket: string;
  expiresIn: number;
}

function validateUploadInput(
  contentType: string,
  fileSize: number,
  folder: UploadFolder
): { bucket: string } {
  const isPrivate = folder === "kyc";
  const bucket = isPrivate ? PRIVATE_BUCKET : PUBLIC_BUCKET;
  const allowed = folder === "kyc" ? ALLOWED_DOCUMENT_TYPES : ALLOWED_IMAGE_TYPES;
  const maxMB = folder === "kyc" ? UPLOAD_MAX_DOCUMENT_MB : UPLOAD_MAX_IMAGE_MB;

  if (!validateFileType(contentType, allowed)) {
    throw new ValidationError(`File type not allowed for ${folder}.`, {
      contentType: `Accepted: ${allowed.join(", ")}`,
    });
  }

  if (!validateFileSize(fileSize, maxMB)) {
    throw new ValidationError(`File too large. Maximum size: ${maxMB} MB`, {
      fileSize: `Must be under ${maxMB} MB`,
    });
  }

  return { bucket };
}

/** Upload via API (avoids browser → MinIO CORS). */
export async function uploadDirect(
  buffer: Buffer,
  req: SignUploadRequest
): Promise<{ url: string; fileKey: string; bucket: string }> {
  const { fileName, contentType, fileSize, folder, userId } = req;
  const { bucket } = validateUploadInput(contentType, fileSize, folder);
  const fileKey = generateFileKey(folder, userId, fileName);

  await putObjectBuffer(bucket, fileKey, buffer, contentType);
  logger.info("File uploaded via API proxy", { userId, folder, fileKey, bucket });

  if (bucket === PUBLIC_BUCKET) {
    return { url: getPublicUrl(fileKey), fileKey, bucket };
  }
  const url = await generatePresignedDownloadUrl(bucket, fileKey, 60 * 60 * 24);
  return { url, fileKey, bucket };
}

export async function signUpload(req: SignUploadRequest): Promise<SignUploadResponse> {
  const { fileName, contentType, fileSize, folder, userId } = req;

  validateUploadInput(contentType, fileSize, folder);
  const isPrivate = folder === "kyc";
  const bucket = isPrivate ? PRIVATE_BUCKET : PUBLIC_BUCKET;

  const fileKey = generateFileKey(folder, userId, fileName);
  const result = await generatePresignedUploadUrl(bucket, fileKey, contentType);

  logger.info("Presigned upload URL generated", { userId, folder, fileKey, bucket });

  return {
    uploadUrl: result.uploadUrl,
    fileKey,
    bucket,
    expiresIn: result.expiresIn,
    publicUrl: isPrivate ? null : getPublicUrl(fileKey),
  };
}

function assertUploadKeyOwnedByUser(fileKey: string, userId: string): void {
  const parts = fileKey.split("/");
  if (parts.length < 3 || parts[1] !== userId) {
    throw new ForbiddenError("You cannot confirm this upload.");
  }
}

export async function confirmUpload(
  bucket: string,
  fileKey: string,
  userId: string
): Promise<{ url: string }> {
  if (bucket !== PUBLIC_BUCKET && bucket !== PRIVATE_BUCKET) {
    throw new ValidationError("Invalid bucket", { bucket: "Unknown bucket" });
  }

  assertUploadKeyOwnedByUser(fileKey, userId);

  const exists = await objectExists(bucket, fileKey);
  if (!exists) {
    throw new ValidationError("Upload not found or not completed yet.", {
      fileKey: "Object missing in storage — retry after PUT completes",
    });
  }

  if (bucket === PUBLIC_BUCKET) {
    return { url: getPublicUrl(fileKey) };
  }

  const url = await generatePresignedDownloadUrl(bucket, fileKey, 60 * 60 * 24);
  return { url };
}

export async function getPrivateDownloadUrl(
  fileKey: string,
  requestingUserId: string,
  role: string
): Promise<string> {
  const isAdmin = role === "ADMIN";
  const isOwnKyc = fileKey.startsWith(`kyc/${requestingUserId}/`);
  if (!isAdmin && !isOwnKyc) {
    throw new ForbiddenError("Access to this file is restricted.");
  }
  return generatePresignedDownloadUrl(PRIVATE_BUCKET, fileKey, 3600);
}
