import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/http";
import { isSameOrigin } from "@/lib/security/request";
import { deleteDraftUpload } from "@/lib/uploads/service";

export async function DELETE(request: Request, { params }: RouteContext<"/api/uploads/[id]">) {
  if (!isSameOrigin(request)) return jsonError(403, "Forbidden");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError(404, "Not found");
  try {
    const removed = await deleteDraftUpload(id);
    return removed ? new NextResponse(null, { status: 204 }) : jsonError(404, "Not found");
  } catch (err) {
    return handleRouteError(err, "Draft upload delete");
  }
}
