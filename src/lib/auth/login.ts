import "server-only";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/db";
import { admins, applicants } from "@/db/schema";
import { appUrl, bootstrapAdminEmails } from "@/lib/env";
import { recordAuditSafe } from "@/lib/audit";
import { sendEmail } from "@/lib/email/client";
import { verificationEmail } from "@/lib/email/templates";
import { hmac } from "@/lib/security/crypto";
import { logger } from "@/lib/security/logger";
import { rateLimitAll } from "@/lib/security/rate-limit";
import type { RequestContext } from "@/lib/security/request";
import { verifyTurnstile } from "@/lib/turnstile/verify";
import { CODE_TTL_MINUTES, issueCode, verifyCode, verifyLinkToken, VERIFY_MESSAGES } from "./codes";
import { createSession, type SessionKind } from "./session";

/**
 * Passwordless sign-in for both admins and applicants. Responses are generic
 * so they never reveal whether an email is registered.
 */

export type RequestCodeResult = { ok: true } | { ok: false; error: string };
export type VerifyLoginResult = { ok: true; redirectTo: string } | { ok: false; error: string };

const GENERIC_INVALID = VERIFY_MESSAGES.invalid;

async function findAdminId(email: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db.select({ id: admins.id, isActive: admins.isActive }).from(admins).where(eq(admins.email, email)).limit(1);
  if (row) return row.isActive ? row.id : null;

  // Bootstrap: emails listed in ADMIN_EMAILS become super admins on first sign-in.
  if (bootstrapAdminEmails().includes(email)) {
    const [created] = await db
      .insert(admins)
      .values({ email, name: email.split("@")[0] ?? "Administrator", role: "SUPER_ADMIN" })
      .onConflictDoNothing()
      .returning({ id: admins.id });
    if (created) {
      await recordAuditSafe({ actor: { type: "SYSTEM" }, action: "admin.created", targetType: "admin", targetId: created.id, metadata: { via: "bootstrap" } });
      return created.id;
    }
  }
  return null;
}

async function findApplicantId(email: string): Promise<string | null> {
  const [row] = await getDb().select({ id: applicants.id }).from(applicants).where(eq(applicants.email, email)).limit(1);
  return row?.id ?? null;
}

function findUserId(kind: SessionKind, email: string) {
  return kind === "admin" ? findAdminId(email) : findApplicantId(email);
}

function verifyPath(kind: SessionKind) {
  return kind === "admin" ? "/admin/verify" : "/portal/verify";
}

export async function requestLoginCode(opts: {
  kind: SessionKind;
  email: string;
  turnstileToken: string | null;
  ctx: RequestContext;
  redirectPath?: string | null;
}): Promise<RequestCodeResult> {
  const { kind, email, ctx } = opts;
  const emailKey = hmac("rl-email", email).slice(0, 32);

  const limited = await rateLimitAll([
    ["authRequestByEmail", `${kind}:${emailKey}`],
    ["authRequestByIp", `${kind}:${ctx.ipHash ?? "unknown"}`],
  ]);
  if (!limited.success) {
    return { ok: false, error: `Too many requests. Please wait ${Math.ceil(limited.retryAfterSeconds / 60)} minute(s) and try again.` };
  }

  const bot = await verifyTurnstile({
    token: opts.turnstileToken,
    action: kind === "admin" ? "admin_login" : "portal_login",
    remoteIp: ctx.ip,
  });
  if (!bot.success) return { ok: false, error: "Please complete the security check and try again." };

  // Look up the user and send the email after responding, so response time
  // doesn't reveal whether the address is registered.
  after(async () => {
    try {
      const userId = await findUserId(kind, email);
      if (!userId) {
        logger.info("Sign-in requested for unknown email", { kind, emailKey });
        return;
      }
      const { code, linkToken } = await issueCode(kind, userId, { ipHash: ctx.ipHash, redirectPath: opts.redirectPath });
      const link = `${appUrl()}${verifyPath(kind)}?token=${encodeURIComponent(linkToken)}`;
      const result = await sendEmail(email, verificationEmail({ code, link, minutes: CODE_TTL_MINUTES, audience: kind }));
      if (result.status === "FAILED") logger.error("Verification email failed", { kind, errorCode: result.errorCode });
    } catch (err) {
      logger.error("Issuing verification code failed", { kind, err });
    }
  });
  return { ok: true };
}

async function completeLogin(kind: SessionKind, userId: string, ctx: RequestContext, redirectPath: string | null): Promise<VerifyLoginResult> {
  await createSession(kind, userId, ctx);
  if (kind === "admin") {
    await getDb().update(admins).set({ lastLoginAt: new Date() }).where(eq(admins.id, userId));
    await recordAuditSafe({ actor: { type: "ADMIN", adminId: userId }, action: "admin.login", ipHash: ctx.ipHash });
    return { ok: true, redirectTo: "/admin/dashboard" };
  }
  await recordAuditSafe({ actor: { type: "APPLICANT", applicantId: userId }, action: "applicant.login", ipHash: ctx.ipHash });
  return { ok: true, redirectTo: redirectPath && redirectPath.startsWith("/portal") ? redirectPath : "/portal" };
}

async function verifyRateLimit(kind: SessionKind, ctx: RequestContext): Promise<string | null> {
  const limited = await rateLimitAll([["authVerifyByIp", `${kind}:${ctx.ipHash ?? "unknown"}`]]);
  return limited.success ? null : "Too many attempts. Please wait a few minutes and try again.";
}

export async function verifyLoginCode(opts: { kind: SessionKind; email: string; code: string; ctx: RequestContext }): Promise<VerifyLoginResult> {
  const limitedError = await verifyRateLimit(opts.kind, opts.ctx);
  if (limitedError) return { ok: false, error: limitedError };

  const userId = opts.kind === "admin" ? await existingAdminId(opts.email) : await findApplicantId(opts.email);
  if (!userId) return { ok: false, error: GENERIC_INVALID };

  const result = await verifyCode(opts.kind, userId, opts.code.trim());
  if (!result.ok) {
    if (opts.kind === "admin") {
      await recordAuditSafe({ actor: { type: "ADMIN", adminId: userId }, action: "admin.login_failed", ipHash: opts.ctx.ipHash, metadata: { reason: result.reason } });
    }
    return { ok: false, error: VERIFY_MESSAGES[result.reason] };
  }
  return completeLogin(opts.kind, userId, opts.ctx, result.redirectPath);
}

export async function verifyLoginLink(opts: { kind: SessionKind; token: string; ctx: RequestContext }): Promise<VerifyLoginResult> {
  const limitedError = await verifyRateLimit(opts.kind, opts.ctx);
  if (limitedError) return { ok: false, error: limitedError };

  const result = await verifyLinkToken(opts.kind, opts.token);
  if (!result.ok) {
    return { ok: false, error: result.reason === "expired" ? "This sign-in link has expired. Please request a new one." : "This sign-in link is invalid or has already been used." };
  }
  if (opts.kind === "admin" && !(await isActiveAdmin(result.userId))) {
    return { ok: false, error: "This sign-in link is invalid or has already been used." };
  }
  return completeLogin(opts.kind, result.userId, opts.ctx, result.redirectPath);
}

async function existingAdminId(email: string): Promise<string | null> {
  const [row] = await getDb().select({ id: admins.id, isActive: admins.isActive }).from(admins).where(eq(admins.email, email)).limit(1);
  return row?.isActive ? row.id : null;
}

async function isActiveAdmin(id: string): Promise<boolean> {
  const [row] = await getDb().select({ isActive: admins.isActive }).from(admins).where(eq(admins.id, id)).limit(1);
  return Boolean(row?.isActive);
}
