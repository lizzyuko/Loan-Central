"use client";

/**
 * Browser-side upload flow:
 *  1. ask our server for a signed, constrained upload (POST /api/uploads/sign)
 *  2. upload the file directly to Cloudinary (private "authenticated" asset)
 *  3. ask our server to verify + record it (POST /api/uploads/complete)
 * The browser never receives the API secret, and our server re-checks the
 * stored asset rather than trusting what the browser reports.
 */

export interface UploadContext {
  documentType: string;
  applicationId?: string;
  informationRequestId?: string;
}

export interface UploadedDocumentResult {
  id: string;
  documentType: string;
  filename: string;
  bytes: number;
}

interface SignResponse {
  uploadUrl: string;
  fields: Record<string, string>;
  publicId: string;
}

export class UploadError extends Error {}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

function sendToCloudinary(url: string, form: FormData, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new UploadError("The upload was rejected. Please try a different file.")));
    xhr.onerror = () => reject(new UploadError("Network error during upload. Please try again."));
    xhr.send(form);
  });
}

export async function uploadDocument(
  file: File,
  ctx: UploadContext,
  onProgress?: (pct: number) => void,
): Promise<UploadedDocumentResult> {
  const signRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...ctx, filename: file.name, bytes: file.size, mimeType: file.type }),
  });
  if (!signRes.ok) throw new UploadError(await readError(signRes, "Document upload failed. Please try again."));
  const sign = (await signRes.json()) as SignResponse;

  const form = new FormData();
  for (const [k, v] of Object.entries(sign.fields)) form.append(k, v);
  form.append("file", file);
  await sendToCloudinary(sign.uploadUrl, form, onProgress);

  const doneRes = await fetch("/api/uploads/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...ctx, filename: file.name, publicId: sign.publicId }),
  });
  if (!doneRes.ok) throw new UploadError(await readError(doneRes, "We couldn't verify your upload. Please try again."));
  return (await doneRes.json()) as UploadedDocumentResult;
}

export async function deleteDraftDocument(id: string): Promise<void> {
  const res = await fetch(`/api/uploads/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new UploadError(await readError(res, "Couldn't remove the file."));
}
