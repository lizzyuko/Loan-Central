import "server-only";
import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { admins } from "@/db/schema";
import type { AdminRole } from "@/db/schema/enums";
import { hasPermission, type Permission } from "./permissions";
import { readSession } from "./session";

export interface CurrentAdmin {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  sessionId: string;
}

export class AuthError extends Error {
  constructor(public readonly code: "unauthenticated" | "forbidden") {
    super(code === "unauthenticated" ? "Your session has expired. Please sign in again." : "You don't have permission to do that.");
    this.name = "AuthError";
  }
}

/** The signed-in, active admin for this request (memoised per request). */
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const session = await readSession("admin");
  if (!session) return null;
  const [admin] = await getDb()
    .select({ id: admins.id, email: admins.email, name: admins.name, role: admins.role })
    .from(admins)
    .where(and(eq(admins.id, session.userId), eq(admins.isActive, true)))
    .limit(1);
  return admin ? { ...admin, sessionId: session.sessionId } : null;
});

/** For pages: redirect to the admin sign-in when there's no valid session. */
export async function requireAdminPage(permission: Permission = "applications.view"): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin?expired=1");
  if (!hasPermission(admin.role, permission)) redirect("/admin/dashboard?denied=1");
  return admin;
}

/** For server actions / route handlers: throws AuthError instead of redirecting. */
export async function requireAdmin(permission?: Permission): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new AuthError("unauthenticated");
  if (permission && !hasPermission(admin.role, permission)) throw new AuthError("forbidden");
  return admin;
}

export function can(admin: Pick<CurrentAdmin, "role">, permission: Permission): boolean {
  return hasPermission(admin.role, permission);
}
