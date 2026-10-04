import "server-only";
import { eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/db";
import { admins } from "@/db/schema";
import { appUrl } from "@/lib/env";
import { recordAudit, recordAuditSafe } from "@/lib/audit";
import { sendEmail } from "@/lib/email/client";
import { adminInviteEmail, passwordChangedEmail, passwordResetEmail } from "@/lib/email/templates";
import { hmac } from "@/lib/security/crypto";
import { logger } from "@/lib/security/logger";
import { rateLimitAll } from "@/lib/security/rate-limit";
import type { RequestContext } from "@/lib/security/request";
import { verifyTurnstile } from "@/lib/turnstile/verify";
import { consumeAdminToken, issueAdminToken, TOKEN_TTL_MS, type AdminTokenPurpose } from "./admin-tokens";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "./password";
import { createSession, revokeAllSessions } from "./session";

/**
 * Email + password authentication for administrators, with invitations and
 * email-based password reset. Admin accounts are never self-registered.
 */

export type AuthResult = { ok: true; redirectTo: string } | { ok: false; error: string };
export type PlainResult = { ok: true } | { ok: false; error: string };

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

const INVALID = "Incorrect email or password.";

const emailKey = (email: string) => hmac("rl-email", email).slice(0, 32);

export async function loginWithPassword(opts: { email: string; password: string; turnstileToken: string | null; ctx: RequestContext }): Promise<AuthResult> {
  const { email, password, ctx } = opts;
  const limited = await rateLimitAll([
    ["adminLoginByEmail", emailKey(email)],
    ["adminLoginByIp", ctx.ipHash ?? "unknown"],
  ]);
  if (!limited.success) return { ok: false, error: "Too many sign-in attempts. Please wait a few minutes and try again." };

  const bot = await verifyTurnstile({ token: opts.turnstileToken, action: "admin_login", remoteIp: ctx.ip });
  if (!bot.success) return { ok: false, error: "Please complete the security check and try again." };

  const db = getDb();
  const [admin] = await db
    .select({ id: admins.id, passwordHash: admins.passwordHash, isActive: admins.isActive, lockedUntil: admins.lockedUntil })
    .from(admins)
    .where(eq(admins.email, email))
    .limit(1);

  if (!admin || !admin.isActive || !admin.passwordHash) {
    await verifyAgainstDummy(password);
    return { ok: false, error: INVALID };
  }
  if (admin.lockedUntil && admin.lockedUntil.getTime() > Date.now()) {
    await verifyAgainstDummy(password);
    return { ok: false, error: "This account is temporarily locked after too many attempts. Try again later or reset your password." };
  }

  if (!(await verifyPassword(password, admin.passwordHash))) {
    const [row] = await db
      .update(admins)
      .set({ failedLoginAttempts: sql`${admins.failedLoginAttempts} + 1` })
      .where(eq(admins.id, admin.id))
      .returning({ attempts: admins.failedLoginAttempts });
    if (row && row.attempts >= MAX_FAILED_LOGINS) {
      await db.update(admins).set({ lockedUntil: new Date(Date.now() + LOCKOUT_MS), failedLoginAttempts: 0 }).where(eq(admins.id, admin.id));
      await recordAuditSafe({ actor: { type: "ADMIN", adminId: admin.id }, action: "admin.locked", ipHash: ctx.ipHash });
    }
    await recordAuditSafe({ actor: { type: "ADMIN", adminId: admin.id }, action: "admin.login_failed", ipHash: ctx.ipHash });
    return { ok: false, error: INVALID };
  }

  await db.update(admins).set({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(admins.id, admin.id));
  await createSession("admin", admin.id, ctx);
  await recordAuditSafe({ actor: { type: "ADMIN", adminId: admin.id }, action: "admin.login", ipHash: ctx.ipHash });
  return { ok: true, redirectTo: "/admin/dashboard" };
}

function tokenLink(purpose: AdminTokenPurpose, token: string) {
  const path = purpose === "INVITE" ? "/admin/accept-invite" : "/admin/reset-password";
  return `${appUrl()}${path}?token=${encodeURIComponent(token)}`;
}

/** Super admin sends (or re-sends) an invitation. */
export async function sendInvite(adminId: string, invitedBy: { id: string; name: string }) {
  const [target] = await getDb().select({ email: admins.email, name: admins.name }).from(admins).where(eq(admins.id, adminId));
  if (!target) throw new Error("Admin not found");
  const token = await issueAdminToken(adminId, "INVITE", invitedBy.id);
  const result = await sendEmail(
    target.email,
    adminInviteEmail({ name: target.name, inviterName: invitedBy.name, link: tokenLink("INVITE", token), days: TOKEN_TTL_MS.INVITE / 86_400_000 }),
  );
  await recordAudit({ actor: { type: "ADMIN", adminId: invitedBy.id }, action: "admin.invited", targetType: "admin", targetId: adminId, metadata: { deliveryStatus: result.status } });
  return result.status;
}

/** "Forgot password". Always returns ok (no account enumeration). */
export async function requestPasswordReset(opts: { email: string; turnstileToken: string | null; ctx: RequestContext }): Promise<PlainResult> {
  const limited = await rateLimitAll([
    ["passwordResetByEmail", emailKey(opts.email)],
    ["passwordResetByIp", opts.ctx.ipHash ?? "unknown"],
  ]);
  if (!limited.success) return { ok: false, error: "Too many requests. Please wait a while and try again." };
  const bot = await verifyTurnstile({ token: opts.turnstileToken, action: "admin_login", remoteIp: opts.ctx.ip });
  if (!bot.success) return { ok: false, error: "Please complete the security check and try again." };

  after(async () => {
    try {
      const [admin] = await getDb()
        .select({ id: admins.id, name: admins.name, isActive: admins.isActive, passwordHash: admins.passwordHash, invitedBy: admins.invitedByAdminId })
        .from(admins)
        .where(eq(admins.email, opts.email))
        .limit(1);
      if (!admin || !admin.isActive) return;
      if (!admin.passwordHash) {
        // Never accepted their invitation: re-send it instead.
        await sendInvite(admin.id, { id: admin.invitedBy ?? admin.id, name: "The Loan Central team" });
        return;
      }
      const token = await issueAdminToken(admin.id, "PASSWORD_RESET", null);
      await sendEmail(opts.email, passwordResetEmail({ name: admin.name, link: tokenLink("PASSWORD_RESET", token), minutes: TOKEN_TTL_MS.PASSWORD_RESET / 60_000 }));
      await recordAudit({ actor: { type: "ADMIN", adminId: admin.id }, action: "admin.password_reset_requested", ipHash: opts.ctx.ipHash });
    } catch (err) {
      logger.error("Password reset request failed", { err });
    }
  });
  return { ok: true };
}

/** Accept an invitation or complete a reset: set the password and sign in. */
export async function redeemToken(opts: { purpose: AdminTokenPurpose; token: string; password: string; ctx: RequestContext }): Promise<AuthResult> {
  const limited = await rateLimitAll([["tokenRedeemByIp", opts.ctx.ipHash ?? "unknown"]]);
  if (!limited.success) return { ok: false, error: "Too many attempts. Please wait a few minutes." };

  const passwordHash = await hashPassword(opts.password);
  const db = getDb();
  const adminId = await db.transaction(async (tx) => {
    const id = await consumeAdminToken(opts.purpose, opts.token, tx);
    if (!id) return null;
    const [admin] = await tx
      .update(admins)
      .set({ passwordHash, passwordUpdatedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(admins.id, id))
      .returning({ id: admins.id, isActive: admins.isActive });
    if (!admin?.isActive) return null;
    await recordAudit(
      { actor: { type: "ADMIN", adminId: id }, action: opts.purpose === "INVITE" ? "admin.invite_accepted" : "admin.password_reset", ipHash: opts.ctx.ipHash },
      tx,
    );
    return id;
  });
  if (!adminId) {
    return {
      ok: false,
      error: opts.purpose === "INVITE" ? "This invitation is invalid or has expired. Ask an administrator to send a new one." : "This reset link is invalid or has expired. Please request a new one.",
    };
  }

  // Any existing sessions (possibly an attacker's) are ended.
  await revokeAllSessions("admin", adminId);
  if (opts.purpose === "PASSWORD_RESET") await notifyPasswordChanged(adminId);
  await db.update(admins).set({ lastLoginAt: new Date() }).where(eq(admins.id, adminId));
  await createSession("admin", adminId, opts.ctx);
  return { ok: true, redirectTo: "/admin/dashboard" };
}

export async function changePassword(opts: { adminId: string; currentPassword: string; newPassword: string; ctx: RequestContext }): Promise<PlainResult> {
  const db = getDb();
  const [admin] = await db.select({ passwordHash: admins.passwordHash }).from(admins).where(eq(admins.id, opts.adminId));
  if (!admin?.passwordHash || !(await verifyPassword(opts.currentPassword, admin.passwordHash))) {
    return { ok: false, error: "Your current password is incorrect." };
  }
  await db.update(admins).set({ passwordHash: await hashPassword(opts.newPassword), passwordUpdatedAt: new Date() }).where(eq(admins.id, opts.adminId));
  await revokeAllSessions("admin", opts.adminId);
  await createSession("admin", opts.adminId, opts.ctx);
  await recordAudit({ actor: { type: "ADMIN", adminId: opts.adminId }, action: "admin.password_changed", ipHash: opts.ctx.ipHash });
  await notifyPasswordChanged(opts.adminId);
  return { ok: true };
}

async function notifyPasswordChanged(adminId: string) {
  const [a] = await getDb().select({ email: admins.email, name: admins.name }).from(admins).where(eq(admins.id, adminId));
  if (a) await sendEmail(a.email, passwordChangedEmail({ name: a.name, resetUrl: `${appUrl()}/admin/forgot-password` }));
}
