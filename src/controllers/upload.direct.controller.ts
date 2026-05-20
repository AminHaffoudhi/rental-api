import type { Request, Response } from "express";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import * as uploadService from "@/services/upload.service";
import type { UploadFolder } from "@/lib/storage";
import { success } from "@/utils/apiResponse";

const FOLDERS: UploadFolder[] = ["equipment", "avatars", "kyc", "delivery"];

function parseFolder(raw: string | undefined): UploadFolder {
  const f = raw?.trim().toLowerCase();
  if (f && FOLDERS.includes(f as UploadFolder)) {
    return f as UploadFolder;
  }
  throw new ValidationError("Invalid upload folder", { folder: `Use one of: ${FOLDERS.join(", ")}` });
}

export async function directUpload(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  const buffer = req.body;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new ValidationError("Empty upload body", { body: "Send the file as raw bytes" });
  }

  const fileNameHeader = req.headers["x-file-name"];
  const fileName = decodeURIComponent(
    typeof fileNameHeader === "string" ? fileNameHeader : "upload.bin"
  );
  const contentType =
    (typeof req.headers["content-type"] === "string" ? req.headers["content-type"] : "") ||
    "application/octet-stream";
  const folder = parseFolder(
    typeof req.headers["x-upload-folder"] === "string" ? req.headers["x-upload-folder"] : undefined
  );
  const sizeHeader = req.headers["x-file-size"];
  const declaredSize =
    typeof sizeHeader === "string" ? Number.parseInt(sizeHeader, 10) : buffer.length;
  const fileSize = Number.isFinite(declaredSize) && declaredSize > 0 ? declaredSize : buffer.length;

  const result = await uploadService.uploadDirect(buffer, {
    fileName,
    contentType,
    fileSize,
    folder,
    userId: req.user.id,
  });

  success(res, result);
}
