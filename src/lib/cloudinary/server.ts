import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { cloudinaryConfig } from "@/lib/env";

/**
 * All applicant documents are stored as `type: "authenticated"` assets: they
 * are never reachable via a public URL. Access is only through short-lived
 * signed download URLs generated after an authorization check.
 */
export const DELIVERY_TYPE = "authenticated";
/** PDFs and images are both handled as Cloudinary "image" resources. */
export const RESOURCE_TYPE = "image";

let configured = false;

function client() {
  if (!configured) {
    const cfg = cloudinaryConfig();
    cloudinary.config({
      cloud_name: cfg.CLOUDINARY_CLOUD_NAME,
      api_key: cfg.CLOUDINARY_API_KEY,
      api_secret: cfg.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

export interface SignedUpload {
  uploadUrl: string;
  fields: Record<string, string>;
  publicId: string;
}

/**
 * Signs a direct browser upload. Every parameter that constrains the upload
 * (public id, delivery type, allowed formats) is covered by the signature, so
 * the browser can't change them.
 */
export function signUpload({ publicId, allowedFormats }: { publicId: string; allowedFormats: string[] }): SignedUpload {
  const c = client();
  const cfg = cloudinaryConfig();
  const timestamp = Math.round(Date.now() / 1000);
  const params = {
    public_id: publicId,
    timestamp,
    type: DELIVERY_TYPE,
    allowed_formats: allowedFormats.join(","),
    overwrite: "false",
    unique_filename: "false",
  };
  const signature = c.utils.api_sign_request(params, cfg.CLOUDINARY_API_SECRET);
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cfg.CLOUDINARY_CLOUD_NAME}/${RESOURCE_TYPE}/upload`,
    fields: {
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
      api_key: cfg.CLOUDINARY_API_KEY,
      signature,
    },
    publicId,
  };
}

export interface StoredAsset {
  publicId: string;
  bytes: number;
  format: string;
  version: number;
  type: string;
}

/** Fetch authoritative metadata for an uploaded asset (Admin API). */
export async function getAsset(publicId: string): Promise<StoredAsset | null> {
  try {
    const res = (await client().api.resource(publicId, { type: DELIVERY_TYPE, resource_type: RESOURCE_TYPE })) as {
      public_id: string;
      bytes: number;
      format: string;
      version: number;
      type: string;
    };
    return { publicId: res.public_id, bytes: res.bytes, format: res.format, version: res.version, type: res.type };
  } catch {
    return null;
  }
}

export async function deleteAsset(publicId: string): Promise<void> {
  await client().uploader.destroy(publicId, { type: DELIVERY_TYPE, resource_type: RESOURCE_TYPE, invalidate: true });
}

/** Short-lived signed URL that downloads the original private asset. */
export function signedDownloadUrl(publicId: string, format: string | null, ttlSeconds = 300): string {
  return client().utils.private_download_url(publicId, format ?? "", {
    type: DELIVERY_TYPE,
    resource_type: RESOURCE_TYPE,
    expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
    attachment: false,
  });
}
