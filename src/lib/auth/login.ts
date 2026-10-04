import "server-only";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/db";
import { applicants } from "@/db/schema";
import { appUrl } from "@/lib/env";
import { recordAuditSafe } from "@/lib/audit";
import { sendEmail } from "@/lib/email/client";
import { verificationEmail } from "@/lib/email/templates";
import { hmac } from "@/lib/security/crypto";
import { logger } from "@/lib/security/logger";
import { rateLimitAll } from "@/lib/security/rate-limit";
import type { RequestContext } from "@/lib/security/request";
import { verifyTurnstile } from "@/lib/turnstile/verify";
import { CODE_TTL_MINUTES, issueCode, verifyCode, verifyLinkToken, VERIFY_MESSAGES } from "./codes";
import { createSession } from "./session";

/**
 * Passwordless sign-in for APPLICANTS (one-time code or magic link).
 * Responses are generic so they never reveal whether an email has applied.
 * Administrators use email + password (see admin-auth.ts).
 */

export type RequestCodeResult = { ok: true } | { ok: false; error: string };
export type VerifyLoginResult = { ok: true; redirectTo: string } | { ok: false; error: string };

async function findApplicantId(email: string): Promise<string | null> {
  const [row] = await getDb().select({ id: applicants.id }).from(applicants).where(eq(applicants.email, email)).limit(1);
  return row?.id ?? null;
}

export async function requestLoginCode(opts: {
  email: string;
  turnstileToken: string | null;
  ctx: RequestContext;
  redirectPath?: string | null;
}): Promise<RequestCodeResult> {
  const { email, ctx } = opts;
  const emailKey = hmac("rl-email", email).slice(0, 32);

  const limited = await rateLimitAll([
    ["authRequestByEmail", emailKey],
    ["authRequestByIp", ctx.ipHash ?? "unknown"],
  ]);
  if (!limited.success) {
    return { ok: false, error: `Too many requests. Please wait ${Math.ceil(limited.retryAfterSeconds / 60)} minute(s) and try again.` };
  }

  const bot = await verifyTurnstile({ token: opts.turnstileToken, action: "portal_login", remoteIp: ctx.ip });
  if (!bot.success) return { ok: false, error: "Please complete the security check and try again." };

  // Look up and send after responding, so timing doesn't reveal registration.
  after(async () => {
    try {
      const userId = await findApplicantId(email);
      if (!userId) {
        logger.info("Portal sign-in requested for unknown email", { emailKey });
        return;
      }
      const { code, linkToken } = await issueCode("applicant", userId, { ipHash: ctx.ipHash, redirectPath: opts.redirectPath });
      const link = `${appUrl()}/portal/verify?token=${encodeURIComponent(linkToken)}`;
      const result = await sendEmail(email, verificationEmail({ code, link, minutes: CODE_TTL_MINUTES }));
      if (result.status === "FAILED") logger.error("Verification email failed", { errorCode: result.errorCode });
    } catch (err) {
      logger.error("Issuing verification code failed", { err });
    }
  });
  return { ok: true };
}

async function completeLogin(userId: string, ctx: RequestContext, redirectPath: string | null): Promise<VerifyLoginResult> {
  await createSession("applicant", userId, ctx);
  await recordAuditSafe({ actor: { type: "APPLICANT", applicantId: userId }, action: "applicant.login", ipHash: ctx.ipHash });
  return { ok: true, redirectTo: redirectPath && redirectPath.startsWith("/portal") ? redirectPath : "/portal" };
}

async function verifyRateLimit(ctx: RequestContext): Promise<string | null> {
  const limited = await rateLimitAll([["authVerifyByIp", ctx.ipHash ?? "unknown"]]);
  return limited.success ? null : "Too many attempts. Please wait a few minutes and try again.";
}

export async function verifyLoginCode(opts: { email: string; code: string; ctx: RequestContext }): Promise<VerifyLoginResult> {
  const limitedError = await verifyRateLimit(opts.ctx);
  if (limitedError) return { ok: false, error: limitedError };

  const userId = await findApplicantId(opts.email);
  if (!userId) return { ok: false, error: VERIFY_MESSAGES.invalid };

  const result = await verifyCode("applicant", userId, opts.code.trim());
  if (!result.ok) return { ok: false, error: VERIFY_MESSAGES[result.reason] };
  return completeLogin(userId, opts.ctx, result.redirectPath);
}

export async function verifyLoginLink(opts: { token: string; ctx: RequestContext }): Promise<VerifyLoginResult> {
  const limitedError = await verifyRateLimit(opts.ctx);
  if (limitedError) return { ok: false, error: limitedError };

  const result = await verifyLinkToken("applicant", opts.token);
  if (!result.ok) {
    return { ok: false, error: result.reason === "expired" ? "This sign-in link has expired. Please request a new one." : "This sign-in link is invalid or has already been used." };
  }
  return completeLogin(result.userId, opts.ctx, result.redirectPath);
}
