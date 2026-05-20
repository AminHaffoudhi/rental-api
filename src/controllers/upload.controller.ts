import type { Request, Response } from "express";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import * as uploadService from "@/services/upload.service";
import type {
  ConfirmUploadInput,
  SignUploadInput,
  UploadPresignInput,
} from "@/validators/upload.validator";
import { success } from "@/utils/apiResponse";

export async function signUpload(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const body = req.body as SignUploadInput;
  const result = await uploadService.signUpload({
    ...body,
    userId: req.user.id,
  });
  success(res, result);
}

export async function confirmUpload(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const body = req.body as ConfirmUploadInput;
  const data = await uploadService.confirmUpload(body.bucket, body.fileKey, req.user.id);
  success(res, data);
}

export async function getPrivateUrl(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const raw = req.query.key;
  const key = typeof raw === "string" ? raw : Array.isArray(raw) && typeof raw[0] === "string" ? raw[0] : "";
  if (!key.trim()) {
    throw new ValidationError("Missing file key", { key: "Required" });
  }
  const url = await uploadService.getPrivateDownloadUrl(key, req.user.id, req.user.role);
  success(res, { url });
}

/** Backward-compatible presign (older clients). */
export async function presign(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const mapFolder = (f: string | undefined): "equipment" | "avatars" | "kyc" | "delivery" => {
    if (f?.includes("kyc")) return "kyc";
    if (f?.includes("avatar")) return "avatars";
    if (f?.includes("delivery")) return "delivery";
    return "equipment";
  };
  const b = req.body as UploadPresignInput;
  const result = await uploadService.signUpload({
    fileName: b.filename || b.fileName || "upload.bin",
    contentType: b.contentType,
    fileSize: b.fileSize ?? 5 * 1024 * 1024,
    folder: mapFolder(b.folder?.trim()),
    userId: req.user.id,
  });
  success(res, {
    uploadUrl: result.uploadUrl,
    publicUrl: result.publicUrl,
    key: result.fileKey,
    bucket: result.bucket,
    expiresIn: result.expiresIn,
  });
}
