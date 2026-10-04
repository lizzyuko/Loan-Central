import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestContext, isSameOrigin } from "@/lib/security/request";
import { prepareUpload, UploadRejected } from "@/lib/uploads/service";
import { signUploadSchema } from "@/lib/validation/upload";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "Forbidden");
  try {
    const ctx = await getRequestContext();
    const limited = await rateLimit("uploadByIp", ctx.ipHash ?? "unknown");
    if (!limited.success) return jsonError(429, "Too many uploads. Please wait a few minutes and try again.");

    const parsed = signUploadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError(400, "Invalid upload request.");

    const signed = await prepareUpload(parsed.data);
    return NextResponse.json(signed, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof UploadRejected) return jsonError(err.status, err.message);
    return handleRouteError(err, "Upload signing");
  }
}
