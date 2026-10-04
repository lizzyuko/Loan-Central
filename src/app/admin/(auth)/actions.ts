"use server";

import { redirect } from "next/navigation";
import { AuthError, getCurrentAdmin, requireAdmin } from "@/lib/auth/admin";
import { sendInvite } from "@/lib/auth/admin-auth";
import { handleChangePassword, handleForgotPassword, handleLogin, handleLogout, handleSetPassword } from "@/lib/auth/login-actions";
import { recordAuditSafe } from "@/lib/audit";

export async function loginAdmin(raw: unknown) {
  return handleLogin("admin", raw);
}

export async function forgotPassword(raw: unknown) {
  // Admins who never accepted their invitation get the invitation again.
  return handleForgotPassword("admin", raw, (account) =>
    sendInvite(account.id, { id: account.invitedBy ?? account.id, name: "The Loan Central team" }),
  );
}

export async function acceptInvite(raw: unknown) {
  return handleSetPassword("admin", "INVITE", raw);
}

export async function resetPassword(raw: unknown) {
  return handleSetPassword("admin", "PASSWORD_RESET", raw);
}

export async function changeOwnPassword(raw: unknown) {
  try {
    const admin = await requireAdmin();
    return handleChangePassword("admin", admin.id, raw);
  } catch (err) {
    if (err instanceof AuthError) return { ok: false as const, error: err.message };
    throw err;
  }
}

export async function logoutAdmin() {
  const admin = await getCurrentAdmin().catch(() => null);
  if (admin) await recordAuditSafe({ actor: { type: "ADMIN", adminId: admin.id }, action: "admin.logout" });
  await handleLogout("admin");
  redirect("/admin");
}
