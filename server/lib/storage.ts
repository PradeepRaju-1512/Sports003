import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { detectAllowedUploadMime } from "./security.ts";

const configuredUploadDir = process.env.UPLOAD_DIR?.trim();
export const UPLOADS_DIR = configuredUploadDir
  ? path.resolve(configuredUploadDir)
  : path.resolve(process.cwd(), "uploads");
export const PLAYER_UPLOADS_DIR = configuredUploadDir
  ? path.join(UPLOADS_DIR, "players")
  : path.resolve(process.cwd(), "public/uploads/players");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(PLAYER_UPLOADS_DIR)) {
  fs.mkdirSync(PLAYER_UPLOADS_DIR, { recursive: true });
}

interface S3Config {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string;
}

function getS3Config(): S3Config | null {
  const bucket = process.env.S3_BUCKET?.trim();
  const endpoint = process.env.S3_ENDPOINT?.trim()?.replace(/\/+$/, "");
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) return null;
  const region = process.env.S3_REGION?.trim() || "auto";
  const publicUrl =
    process.env.S3_PUBLIC_URL?.trim()?.replace(/\/+$/, "") || `${endpoint}/${bucket}`;
  return { bucket, endpoint, region, accessKeyId, secretAccessKey, publicUrl };
}

export function validateStorageConfig(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (!getS3Config() && !configuredUploadDir) {
    console.warn(
      "[STORAGE WARNING] Neither S3 object storage nor UPLOAD_DIR is configured in production; uploads will use ephemeral local disk."
    );
  }
}

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
};

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB strict limit
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      const err = new Error("Unsupported file type. Allowed: JPEG, PNG, WebP, GIF, PDF.");
      (err as Error & { status?: number }).status = 400;
      cb(err);
      return;
    }
    cb(null, true);
  },
});

function sha256Hex(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}

async function putObjectS3(
  cfg: S3Config,
  objectKey: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const url = new URL(`${cfg.endpoint}/${cfg.bucket}/${objectKey}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(buffer);

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${url.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256(`AWS4${cfg.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, cfg.region);
  const kService = hmacSha256(kRegion, "s3");
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = crypto
    .createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");

  const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const resp = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
    body: new Uint8Array(buffer),
  });

  if (!resp.ok) {
    throw new Error(`Object storage upload failed with status ${resp.status}.`);
  }

  return `${cfg.publicUrl}/${objectKey}`;
}

/**
 * Inspects file buffer magic bytes before persisting to S3-compatible storage or disk.
 */
export async function saveValidatedUpload(
  buffer: Buffer,
  subdir?: "players"
): Promise<{
  filename: string;
  url: string;
  mimeType: string;
  size: number;
}> {
  const detectedMime = detectAllowedUploadMime(buffer);
  if (!detectedMime) {
    const err = new Error(
      "File signature rejected. Only valid JPEG, PNG, WebP, GIF, or PDF files are allowed."
    );
    (err as Error & { status?: number }).status = 400;
    throw err;
  }

  if (subdir === "players" && detectedMime === "application/pdf") {
    const err = new Error("Player portrait upload must be an image (JPEG, PNG, WebP, or GIF).");
    (err as Error & { status?: number }).status = 400;
    throw err;
  }

  const ext = MIME_TO_EXT[detectedMime] ?? ".bin";
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;

  const s3 = getS3Config();
  if (s3) {
    const objectKey = subdir ? `${subdir}/${filename}` : filename;
    const url = await putObjectS3(s3, objectKey, buffer, detectedMime);
    return {
      filename,
      url,
      mimeType: detectedMime,
      size: buffer.length,
    };
  }

  const targetDir = subdir === "players" ? PLAYER_UPLOADS_DIR : UPLOADS_DIR;
  const fullPath = path.join(targetDir, filename);
  fs.writeFileSync(fullPath, buffer);

  return {
    filename,
    url: subdir === "players" ? `/uploads/players/${filename}` : `/uploads/${filename}`,
    mimeType: detectedMime,
    size: buffer.length,
  };
}
