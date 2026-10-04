import "server-only";
import { eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { getDb, type DbOrTx } from "@/db";
import { admins, applicants } from "@/db/schema";
import { appUrl } from "@/lib/env";
import { recordAudit, recordAuditSafe, type Actor, type AuditAction } from "@/lib/audit";
import { sendEmail } from "@/lib/email/client";
import { passwordChangedEmail, passwordResetEmail } from "@/lib/email/templates";
import { hmac } from "@/lib/security/crypto";
import { logger } from "@/lib/security/logger";
import { rateLimitAll } from "@/lib/security/rate-limit";
import type { RequestContext } from "@/lib/security/request";
import { verifyTurnstile } from "@/lib/turnstile/verify";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "./password";
import { createSession, revokeAllSessions } from "./session";
import { consumeToken, issueToken, TOKEN_TTL_MS, type AccountKind, type TokenPurpose } from "./tokens";

/**
 * Email + password authentication shared by administrators and applicants:
 * sign-in with lockout, email-based password reset, token redemption
 * (reset or admin invitation) and password change.
 */

export type AuthResult = { ok: true; redirectTo: string } | { ok: false; error: string };
export type PlainResult = { ok: true } | { ok: false; error: string };

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

const INVALID = "Incorrect email or password.";

interface Account {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  lockedUntil: Date | null;
  active: boolean;
  invitedBy: string | null;
}

const BASE: Record<AccountKind, string> = { admin: "/admin", applicant: "/portal" };
const HOME: Record<AccountKind, string> = { admin: "/admin/dashboard", applicant: "/portal" };

const actorFor = (kind: AccountKind, id: string): Actor => (kind === "admin" ? { type: "ADMIN", adminId: id } : { type: "APPLICANT", applicantId: id });
const action = (kind: AccountKind, suffix: string) => `${kind}.${suffix}` as AuditAction;
const emailKey = (email: string) => hmac("rl-email", email).slice(0, 32);

async function findByEmail(kind: AccountKind, email: string): Promise<Account | null> {
  const db = getDb();
  if (kind === "admin") {
    const [a] = await db
      .select({ id: admins.id, name: admins.name, email: admins.email, passwordHash: admins.passwordHash, lockedUntil: admins.lockedUntil, active: admins.isActive, invitedBy: admins.invitedByAdminId })
      .from(admins)
      .where(eq(admins.email, email))
      .limit(1);
    return a ?? null;
  }
  const [a] = await db
    .select({ id: applicants.id, name: applicants.firstName, email: applicants.email, passwordHash: applicants.passwordHash, lockedUntil: applicants.lockedUntil })
    .from(applicants)
    .where(eq(applicants.email, email))
    .limit(1);
  return a ? { ...a, active: true, invitedBy: null } : null;
}

async function findById(kind: AccountKind, id: string): Promise<Account | null> {
  const db = getDb();
  const [row] =
    kind === "admin"
      ? await db.select({ email: admins.email }).from(admins).where(eq(admins.id, id))
      : await db.select({ email: applicants.email }).from(applicants).where(eq(applicants.id, id));
  return row ? findByEmail(kind, row.email) : null;
}

type Patch = Partial<{ passwordHash: string; passwordUpdatedAt: Date; failedLoginAttempts: number; lockedUntil: Date | null; lastLoginAt: Date }>;

async function update(kind: AccountKind, id: string, patch: Patch, db: DbOrTx = getDb()) {
  if (kind === "admin") await db.update(admins).set(patch).where(eq(admins.id, id));
  else await db.update(applicants).set(patch).where(eq(applicants.id, id));
}

async function incrementFailures(kind: AccountKind, id: string): Promise<number> {
  const db = getDb();
  const [row] =
    kind === "admin"
      ? await db.update(admins).set({ failedLoginAttempts: sql`${admins.failedLoginAttempts} + 1` }).where(eq(admins.id, id)).returning({ n: admins.failedLoginAttempts })
      : await db.update(applicants).set({ failedLoginAttempts: sql`${applicants.failedLoginAttempts} + 1` }).where(eq(applicants.id, id)).returning({ n: applicants.failedLoginAttempts });
  return row?.n ?? 0;
}

// --- Sign in ----------------------------------------------------------------------

export async function loginWithPassword(
  kind: AccountKind,
  opts: { email: string; password: string; turnstileToken: string | null; ctx: RequestContext; next?: string | null },
): Promise<AuthResult> {
  const { email, password, ctx } = opts;
  const limited = await rateLimitAll([
    ["loginByEmail", `${kind}:${emailKey(email)}`],
    ["loginByIp", `${kind}:${ctx.ipHash ?? "unknown"}`],
  ]);
  if (!limited.success) return { ok: false, error: "Too many sign-in attempts. Please wait a few minutes and try again." };

  const bot = await verifyTurnstile({ token: opts.turnstileToken, action: kind === "admin" ? "admin_login" : "portal_login", remoteIp: ctx.ip });
  if (!bot.success) return { ok: false, error: "Please complete the security check and try again." };

  const account = await findByEmail(kind, email);
  if (!account || !account.active || !account.passwordHash) {
    await verifyAgainstDummy(password);
    return { ok: false, error: INVALID };
  }
  if (account.lockedUntil && account.lockedUntil.getTime() > Date.now()) {
    await verifyAgainstDummy(password);
    return { ok: false, error: "This account is temporarily locked after too many attempts. Try again later or reset your password." };
  }

  if (!(await verifyPassword(password, account.passwordHash))) {
    const failures = await incrementFailures(kind, account.id);
    if (failures >= MAX_FAILED_LOGINS) {
      await update(kind, account.id, { lockedUntil: new Date(Date.now() + LOCKOUT_MS), failedLoginAttempts: 0 });
      await recordAuditSafe({ actor: actorFor(kind, account.id), action: action(kind, "locked"), ipHash: ctx.ipHash });
    }
    await recordAuditSafe({ actor: actorFor(kind, account.id), action: action(kind, "login_failed"), ipHash: ctx.ipHash });
    return { ok: false, error: INVALID };
  }

  await update(kind, account.id, { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() });
  await createSession(kind, account.id, ctx);
  await recordAuditSafe({ actor: actorFor(kind, account.id), action: action(kind, "login"), ipHash: ctx.ipHash });
  const next = opts.next && opts.next.startsWith(`${BASE[kind]}/`) && !opts.next.startsWith("//") ? opts.next : HOME[kind];
  return { ok: true, redirectTo: next };
}

// --- Password reset -------------------------------------------------------------------

export function tokenLink(kind: AccountKind, purpose: TokenPurpose, token: string) {
  const page = purpose === "INVITE" ? "accept-invite" : "reset-password";
  return `${appUrl()}${BASE[kind]}/${page}?token=${encodeURIComponent(token)}`;
}

/** "Forgot password". Always returns ok (no account enumeration). */
export async function requestPasswordReset(
  kind: AccountKind,
  opts: { email: string; turnstileToken: string | null; ctx: RequestContext; onPendingInvite?: (account: Account) => Promise<unknown> },
): Promise<PlainResult> {
  const limited = await rateLimitAll([
    ["passwordResetByEmail", `${kind}:${emailKey(opts.email)}`],
    ["passwordResetByIp", `${kind}:${opts.ctx.ipHash ?? "unknown"}`],
  ]);
  if (!limited.success) return { ok: false, error: "Too many requests. Please wait a while and try again." };
  const bot = await verifyTurnstile({ token: opts.turnstileToken, action: kind === "admin" ? "admin_login" : "portal_login", remoteIp: opts.ctx.ip });
  if (!bot.success) return { ok: false, error: "Please complete the security check and try again." };

  // Look up + send after responding so timing doesn't reveal registration.
  after(async () => {
    try {
      const account = await findByEmail(kind, opts.email);
      if (!account || !account.active) return;
      if (kind === "admin" && !account.passwordHash && opts.onPendingInvite) {
        await opts.onPendingInvite(account);
        return;
      }
      // Applicants created before passwords existed can set one this way too.
      const token = await issueToken(kind, account.id, "PASSWORD_RESET", null);
      await sendEmail(
        account.email,
        passwordResetEmail({ name: account.name, link: tokenLink(kind, "PASSWORD_RESET", token), minutes: TOKEN_TTL_MS.PASSWORD_RESET / 60_000, audience: kind }),
      );
      await recordAudit({ actor: actorFor(kind, account.id), action: action(kind, "password_reset_requested"), ipHash: opts.ctx.ipHash });
    } catch (err) {
      logger.error("Password reset request failed", { kind, err });
    }
  });
  return { ok: true };
}

/** Complete a reset (or accept an admin invitation): set the password and sign in. */
export async function redeemToken(kind: AccountKind, opts: { purpose: TokenPurpose; token: string; password: string; ctx: RequestContext }): Promise<AuthResult> {
  const limited = await rateLimitAll([["tokenRedeemByIp", `${kind}:${opts.ctx.ipHash ?? "unknown"}`]]);
  if (!limited.success) return { ok: false, error: "Too many attempts. Please wait a few minutes." };

  const passwordHash = await hashPassword(opts.password);
  const userId = await getDb().transaction(async (tx) => {
    const id = await consumeToken(kind, opts.purpose, opts.token, tx);
    if (!id) return null;
    await update(kind, id, { passwordHash, passwordUpdatedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null }, tx);
    await recordAudit({ actor: actorFor(kind, id), action: action(kind, opts.purpose === "INVITE" ? "invite_accepted" : "password_reset"), ipHash: opts.ctx.ipHash }, tx);
    return id;
  });
  const account = userId ? await findById(kind, userId) : null;
  if (!userId || !account?.active) {
    return {
      ok: false,
      error: opts.purpose === "INVITE" ? "This invitation is invalid or has expired. Ask an administrator to send a new one." : "This reset link is invalid or has expired. Please request a new one.",
    };
  }

  // End every existing session (possibly an attacker's), then sign in fresh.
  await revokeAllSessions(kind, userId);
  if (opts.purpose === "PASSWORD_RESET") await notifyPasswordChanged(kind, account);
  await update(kind, userId, { lastLoginAt: new Date() });
  await createSession(kind, userId, opts.ctx);
  return { ok: true, redirectTo: HOME[kind] };
}

export async function changePassword(kind: AccountKind, opts: { userId: string; currentPassword: string; newPassword: string; ctx: RequestContext }): Promise<PlainResult> {
  const account = await findById(kind, opts.userId);
  if (!account?.passwordHash || !(await verifyPassword(opts.currentPassword, account.passwordHash))) {
    return { ok: false, error: "Your current password is incorrect." };
  }
  await update(kind, opts.userId, { passwordHash: await hashPassword(opts.newPassword), passwordUpdatedAt: new Date() });
  await revokeAllSessions(kind, opts.userId);
  await createSession(kind, opts.userId, opts.ctx);
  await recordAudit({ actor: actorFor(kind, opts.userId), action: action(kind, "password_changed"), ipHash: opts.ctx.ipHash });
  await notifyPasswordChanged(kind, account);
  return { ok: true };
}

async function notifyPasswordChanged(kind: AccountKind, account: Account) {
  await sendEmail(account.email, passwordChangedEmail({ name: account.name, resetUrl: `${appUrl()}${BASE[kind]}/forgot-password`, audience: kind }));
}
