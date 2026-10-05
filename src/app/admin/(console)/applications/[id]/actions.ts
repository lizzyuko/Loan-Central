"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { AuthError, requireAdmin } from "@/lib/auth/admin";
import type { Permission } from "@/lib/auth/permissions";
import {
  addNote,
  changeStatus,
  recordEligibility,
  requestAccountDetails,
  requestInformation,
  revealAccountDetails,
  revealNationalId,
  sendCustomMessage,
  type ReviewResult,
} from "@/lib/admin/review";
import { logger } from "@/lib/security/logger";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestContext } from "@/lib/security/request";
import {
  accountRequestSchema,
  applicationIdSchema,
  changeStatusSchema,
  customMessageSchema,
  eligibilitySchema,
  noteSchema,
  requestInfoSchema,
} from "@/lib/validation/admin";

/** Authenticate + authorize + validate, then run the service. */
async function run<S extends z.ZodType>(
  permission: Permission,
  schema: S,
  raw: unknown,
  fn: (admin: Awaited<ReturnType<typeof requireAdmin>>, input: z.output<S>) => Promise<ReviewResult>,
): Promise<ReviewResult> {
  try {
    const admin = await requireAdmin(permission);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    const result = await fn(admin, parsed.data);
    const appId = (parsed.data as { applicationId?: string }).applicationId;
    if (result.ok && appId) revalidatePath(`/admin/applications/${appId}`);
    return result;
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    logger.error("Admin action failed", { err });
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function changeStatusAction(raw: unknown) {
  return run("applications.review", changeStatusSchema, raw, (admin, i) => changeStatus(admin, i.applicationId, i.status, i.notify));
}

export async function requestInfoAction(raw: unknown) {
  return run("communications.send", requestInfoSchema, raw, (admin, i) => requestInformation(admin, i.applicationId, i.items, i.message));
}

export async function eligibilityAction(raw: unknown) {
  return run("applications.review", eligibilitySchema, raw, (admin, i) => recordEligibility(admin, i.applicationId, i.eligible, i.message, i.notify));
}

export async function requestAccountDetailsAction(raw: unknown) {
  return run("applications.review", accountRequestSchema, raw, (admin, i) => requestAccountDetails(admin, i.applicationId, i.message));
}

export async function customMessageAction(raw: unknown) {
  return run("communications.send", customMessageSchema, raw, (admin, i) => sendCustomMessage(admin, i.applicationId, i.subject, i.message));
}

export async function addNoteAction(raw: unknown) {
  return run("notes.create", noteSchema, raw, (admin, i) => addNote(admin, i.applicationId, i.body));
}

export type RevealResult = { ok: true; values: Record<string, string> } | { ok: false; error: string };

/** Super-admin-only, audited, rate-limited reveal of the applicant's national ID number. */
export async function revealNationalIdAction(raw: unknown): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  try {
    const admin = await requireAdmin("identity.reveal");
    const parsed = applicationIdSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Invalid request." };
    const limited = await rateLimit("adminSensitiveByAdmin", admin.id);
    if (!limited.success) return { ok: false, error: "Too many requests. Please wait and try again." };
    const ctx = await getRequestContext();
    const value = await revealNationalId(admin, parsed.data.applicationId, ctx.ipHash);
    if (!value) return { ok: false, error: "No ID number on file." };
    return { ok: true, value };
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    logger.error("ID reveal failed", { err });
    return { ok: false, error: "Something went wrong." };
  }
}

/** Super-admin-only, audited, rate-limited reveal of encrypted account identifiers. */
export async function revealAccountAction(raw: unknown): Promise<RevealResult> {
  try {
    const admin = await requireAdmin("account_details.reveal");
    const parsed = applicationIdSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Invalid request." };
    const limited = await rateLimit("adminSensitiveByAdmin", admin.id);
    if (!limited.success) return { ok: false, error: "Too many requests. Please wait and try again." };
    const ctx = await getRequestContext();
    const values = await revealAccountDetails(admin, parsed.data.applicationId, ctx.ipHash);
    if (!values) return { ok: false, error: "No account details available." };
    return { ok: true, values };
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    logger.error("Account reveal failed", { err });
    return { ok: false, error: "Something went wrong." };
  }
}
