import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/http";
import { isSameOrigin } from "@/lib/security/request";
import { completeUpload, UploadRejected } from "@/lib/uploads/service";
import { completeUploadSchema } from "@/lib/validation/upload";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "Forbidden");
  try {
    const parsed = completeUploadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError(400, "Invalid upload.");
    const doc = await completeUpload(parsed.data);
    return NextResponse.json(doc, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof UploadRejected) return jsonError(err.status, err.message);
    return handleRouteError(err, "Upload completion");
  }
}
