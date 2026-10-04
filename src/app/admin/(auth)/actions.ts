"use server";

import { redirect } from "next/navigation";
import { handleLogout, handleRequestCode, handleVerifyCode, handleVerifyLink } from "@/lib/auth/login-actions";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { recordAuditSafe } from "@/lib/audit";

export async function requestAdminCode(input: unknown) {
  return handleRequestCode("admin", input);
}

export async function verifyAdminCode(input: unknown) {
  return handleVerifyCode("admin", input);
}

export async function verifyAdminLink(input: unknown) {
  return handleVerifyLink("admin", input);
}

export async function logoutAdmin() {
  const admin = await getCurrentAdmin().catch(() => null);
  if (admin) await recordAuditSafe({ actor: { type: "ADMIN", adminId: admin.id }, action: "admin.logout" });
  await handleLogout("admin");
  redirect("/admin");
}
