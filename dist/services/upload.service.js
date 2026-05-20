"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCloudinarySignature = generateCloudinarySignature;
const cloudinary_1 = require("@/lib/cloudinary");
const env_1 = require("@/config/env");
async function generateCloudinarySignature(folder) {
    const timestamp = Math.round(Date.now() / 1000);
    const params = { timestamp };
    if (folder) {
        params.folder = folder;
    }
    const signature = cloudinary_1.cloudinary.utils.api_sign_request(params, env_1.CLOUDINARY_API_SECRET);
    return {
        signature,
        timestamp,
        apiKey: env_1.CLOUDINARY_API_KEY,
        cloudName: env_1.CLOUDINARY_CLOUD_NAME,
        ...(folder ? { folder } : {}),
    };
}
