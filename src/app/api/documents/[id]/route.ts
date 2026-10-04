import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { documents } from "@/db/schema";
import { AuthError, requireAdmin } from "@/lib/auth/admin";
import { recordAudit } from "@/lib/audit";
import { signedDownloadUrl } from "@/lib/cloudinary/server";
import { handleRouteError, jsonError } from "@/lib/http";
import { getRequestContext } from "@/lib/security/request";

/**
 * Secure document viewer for admins. Checks the session and permission,
 * writes an audit record, then redirects to a signed URL that expires in
 * 5 minutes. Document URLs are never embedded in pages.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/documents/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError(404, "Not found");
  try {
    const admin = await requireAdmin("documents.view");
    const [doc] = await getDb()
      .select({
        id: documents.id,
        applicationId: documents.applicationId,
        publicId: documents.cloudinaryPublicId,
        format: documents.cloudinaryFormat,
        documentType: documents.documentType,
      })
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.status, "ATTACHED")));
    if (!doc) return jsonError(404, "Document not found");

    const ctx = await getRequestContext();
    await recordAudit({
      actor: { type: "ADMIN", adminId: admin.id },
      action: "document.accessed",
      applicationId: doc.applicationId,
      targetType: "document",
      targetId: doc.id,
      metadata: { documentType: doc.documentType },
      ipHash: ctx.ipHash,
    });

    const url = signedDownloadUrl(doc.publicId, doc.format);
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err.code === "unauthenticated" ? 401 : 403, err.message);
    return handleRouteError(err, "Document access");
  }
}
