import { z } from "zod";
import { UPLOAD_RULES } from "@/config/site";

/** Extensions that are never accepted, even if renamed or nested. */
const DANGEROUS_EXTENSIONS = new Set([
  "exe", "msi", "bat", "cmd", "com", "scr", "ps1", "vbs", "js", "jse", "jar", "sh", "app", "dmg",
  "html", "htm", "svg", "xml", "php", "py", "rb", "dll", "lnk", "iso", "zip", "rar", "7z", "docm", "xlsm",
]);

export function fileExtension(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? (parts.pop() ?? "") : "";
}

/** Strip path components and unsafe characters; keep a readable name. */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "document";
  const cleaned = base
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || "document";
}

export type FileCheck = { ok: true; extension: string } | { ok: false; error: string };

/** Validates name, type and size. Runs in the browser AND on the server. */
export function checkFile({ filename, bytes, mimeType }: { filename: string; bytes: number; mimeType?: string }): FileCheck {
  const ext = fileExtension(filename);
  const allParts = filename.toLowerCase().split(".").slice(1);
  if (allParts.some((p) => DANGEROUS_EXTENSIONS.has(p))) {
    return { ok: false, error: "This file type isn't allowed." };
  }
  const expectedMime = UPLOAD_RULES.allowedFormats[ext];
  if (!expectedMime) {
    return { ok: false, error: "Upload a PDF, JPG, PNG, WEBP or HEIC file." };
  }
  // Browsers sometimes report an empty MIME type (e.g. HEIC); only reject a clear mismatch.
  if (mimeType && mimeType !== expectedMime && !(ext === "jpg" && mimeType === "image/jpeg")) {
    return { ok: false, error: "The file's type doesn't match its extension." };
  }
  if (!Number.isInteger(bytes) || bytes <= 0) {
    return { ok: false, error: "This file appears to be empty." };
  }
  if (bytes > UPLOAD_RULES.maxBytes) {
    return { ok: false, error: `Files must be ${Math.round(UPLOAD_RULES.maxBytes / 1024 / 1024)} MB or smaller.` };
  }
  return { ok: true, extension: ext };
}

export const documentTypeKey = z
  .string()
  .regex(/^[a-z][a-z0-9_]{1,40}$/, { error: "Invalid document type" });

export const signUploadSchema = z.object({
  documentType: documentTypeKey,
  filename: z.string().min(1).max(255),
  bytes: z.number().int().positive(),
  mimeType: z.string().max(100).optional().default(""),
  /** Present when uploading from the applicant portal. */
  applicationId: z.uuid().optional(),
  informationRequestId: z.uuid().optional(),
});

export const completeUploadSchema = z.object({
  documentType: documentTypeKey,
  filename: z.string().min(1).max(255),
  publicId: z.string().min(1).max(300),
  applicationId: z.uuid().optional(),
  informationRequestId: z.uuid().optional(),
});
