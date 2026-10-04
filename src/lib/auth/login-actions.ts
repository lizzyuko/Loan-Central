import "server-only";
import { z } from "zod";
import { email } from "@/lib/validation/fields";
import { getRequestContext } from "@/lib/security/request";
import { logger } from "@/lib/security/logger";
import { newPasswordSchema } from "./password";
import { changePassword, loginWithPassword, redeemToken, requestPasswordReset, type AuthResult, type PlainResult } from "./password-auth";
import { destroySession } from "./session";
import type { AccountKind, TokenPurpose } from "./tokens";

/**
 * Validated implementations behind the admin and portal auth server actions.
 * Server actions stay thin wrappers that pick the account kind.
 */

const UNEXPECTED = "Something went wrong. Please try again.";

const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: "Enter your password" }).max(128),
  turnstileToken: z.string().max(2048).nullable(),
  next: z.string().max(300).optional().nullable(),
});
const forgotSchema = z.object({ email, turnstileToken: z.string().max(2048).nullable() });
const setPasswordSchema = z
  .object({ token: z.string().min(32).max(128), password: newPasswordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], error: "Passwords don't match" });
export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(128), password: newPasswordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], error: "Passwords don't match" })
  .refine((v) => v.password !== v.currentPassword, { path: ["password"], error: "Choose a different password from your current one" });

const firstError = (err: z.ZodError) => err.issues[0]?.message ?? "Please check your input.";

export async function handleLogin(kind: AccountKind, raw: unknown): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    return await loginWithPassword(kind, { ...parsed.data, ctx: await getRequestContext() });
  } catch (err) {
    logger.error("Login failed", { kind, err });
    return { ok: false, error: UNEXPECTED };
  }
}

export async function handleForgotPassword(
  kind: AccountKind,
  raw: unknown,
  onPendingInvite?: Parameters<typeof requestPasswordReset>[1]["onPendingInvite"],
): Promise<PlainResult> {
  const parsed = forgotSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };
  try {
    return await requestPasswordReset(kind, { ...parsed.data, ctx: await getRequestContext(), onPendingInvite });
  } catch (err) {
    logger.error("Forgot password failed", { kind, err });
    return { ok: false, error: UNEXPECTED };
  }
}

export async function handleSetPassword(kind: AccountKind, purpose: TokenPurpose, raw: unknown): Promise<AuthResult> {
  const parsed = setPasswordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    return await redeemToken(kind, { purpose, token: parsed.data.token, password: parsed.data.password, ctx: await getRequestContext() });
  } catch (err) {
    logger.error("Set password failed", { kind, purpose, err });
    return { ok: false, error: UNEXPECTED };
  }
}

export async function handleChangePassword(kind: AccountKind, userId: string, raw: unknown): Promise<PlainResult> {
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    return await changePassword(kind, { userId, currentPassword: parsed.data.currentPassword, newPassword: parsed.data.password, ctx: await getRequestContext() });
  } catch (err) {
    logger.error("Change password failed", { kind, err });
    return { ok: false, error: UNEXPECTED };
  }
}

export async function handleLogout(kind: AccountKind): Promise<void> {
  try {
    await destroySession(kind);
  } catch (err) {
    logger.error("Logout failed", { kind, err });
  }
}
