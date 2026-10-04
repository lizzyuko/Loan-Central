"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { changePassword, loginWithPassword, redeemToken, requestPasswordReset, type AuthResult, type PlainResult } from "@/lib/auth/admin-auth";
import { AuthError, getCurrentAdmin, requireAdmin } from "@/lib/auth/admin";
import { handleLogout } from "@/lib/auth/login-actions";
import { newPasswordSchema } from "@/lib/auth/password";
import { recordAuditSafe } from "@/lib/audit";
import { logger } from "@/lib/security/logger";
import { getRequestContext } from "@/lib/security/request";
import { email } from "@/lib/validation/fields";

const UNEXPECTED = "Something went wrong. Please try again.";

const loginSchema = z.object({ email, password: z.string().min(1, { error: "Enter your password" }).max(128), turnstileToken: z.string().max(2048).nullable() });
const forgotSchema = z.object({ email, turnstileToken: z.string().max(2048).nullable() });
const setPasswordSchema = z
  .object({ token: z.string().min(32).max(128), password: newPasswordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], error: "Passwords don't match" });
const changeSchema = z
  .object({ currentPassword: z.string().min(1).max(128), password: newPasswordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], error: "Passwords don't match" })
  .refine((v) => v.password !== v.currentPassword, { path: ["password"], error: "Choose a password you haven't used here" });

function firstError(err: z.ZodError) {
  return err.issues[0]?.message ?? "Please check your input.";
}

export async function loginAdmin(raw: unknown): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    return await loginWithPassword({ ...parsed.data, ctx: await getRequestContext() });
  } catch (err) {
    logger.error("Admin login failed", { err });
    return { ok: false, error: UNEXPECTED };
  }
}

export async function forgotPassword(raw: unknown): Promise<PlainResult> {
  const parsed = forgotSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };
  try {
    return await requestPasswordReset({ ...parsed.data, ctx: await getRequestContext() });
  } catch (err) {
    logger.error("Forgot password failed", { err });
    return { ok: false, error: UNEXPECTED };
  }
}

async function setPassword(purpose: "INVITE" | "PASSWORD_RESET", raw: unknown): Promise<AuthResult> {
  const parsed = setPasswordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    return await redeemToken({ purpose, token: parsed.data.token, password: parsed.data.password, ctx: await getRequestContext() });
  } catch (err) {
    logger.error("Set password failed", { purpose, err });
    return { ok: false, error: UNEXPECTED };
  }
}

export async function acceptInvite(raw: unknown) {
  return setPassword("INVITE", raw);
}

export async function resetPassword(raw: unknown) {
  return setPassword("PASSWORD_RESET", raw);
}

export async function changeOwnPassword(raw: unknown): Promise<PlainResult> {
  try {
    const admin = await requireAdmin();
    const parsed = changeSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    return await changePassword({ adminId: admin.id, currentPassword: parsed.data.currentPassword, newPassword: parsed.data.password, ctx: await getRequestContext() });
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    logger.error("Change password failed", { err });
    return { ok: false, error: UNEXPECTED };
  }
}

export async function logoutAdmin() {
  const admin = await getCurrentAdmin().catch(() => null);
  if (admin) await recordAuditSafe({ actor: { type: "ADMIN", adminId: admin.id }, action: "admin.logout" });
  await handleLogout("admin");
  redirect("/admin");
}
