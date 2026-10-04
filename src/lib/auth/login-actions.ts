import "server-only";
import { z } from "zod";
import { email as emailSchema } from "@/lib/validation/fields";
import { getRequestContext, safeRedirectPath } from "@/lib/security/request";
import { logger } from "@/lib/security/logger";
import { requestLoginCode, verifyLoginCode, verifyLoginLink, type RequestCodeResult, type VerifyLoginResult } from "./login";
import { destroySession, type SessionKind } from "./session";

/** Shared implementations behind the applicant portal sign-in server actions. */

const requestSchema = z.object({
  email: emailSchema,
  turnstileToken: z.string().max(2048).nullable(),
  redirectPath: z.string().max(200).optional(),
});
const verifySchema = z.object({ email: emailSchema, code: z.string().max(12) });
const linkSchema = z.object({ token: z.string().min(32).max(128) });

const UNEXPECTED = "Something went wrong. Please try again.";

export async function handleRequestCode(raw: unknown): Promise<RequestCodeResult> {
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };
  try {
    return await requestLoginCode({
      email: parsed.data.email,
      turnstileToken: parsed.data.turnstileToken,
      ctx: await getRequestContext(),
      redirectPath: safeRedirectPath(parsed.data.redirectPath, "/portal"),
    });
  } catch (err) {
    logger.error("Sign-in code request failed", { err });
    return { ok: false, error: UNEXPECTED };
  }
}

export async function handleVerifyCode(raw: unknown): Promise<VerifyLoginResult> {
  const parsed = verifySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "That code isn't valid." };
  try {
    return await verifyLoginCode({ ...parsed.data, ctx: await getRequestContext() });
  } catch (err) {
    logger.error("Code verification failed", { err });
    return { ok: false, error: UNEXPECTED };
  }
}

export async function handleVerifyLink(raw: unknown): Promise<VerifyLoginResult> {
  const parsed = linkSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "This sign-in link is invalid or has already been used." };
  try {
    return await verifyLoginLink({ token: parsed.data.token, ctx: await getRequestContext() });
  } catch (err) {
    logger.error("Link verification failed", { err });
    return { ok: false, error: UNEXPECTED };
  }
}

export async function handleLogout(kind: SessionKind): Promise<void> {
  try {
    await destroySession(kind);
  } catch (err) {
    logger.error("Logout failed", { kind, err });
  }
}
