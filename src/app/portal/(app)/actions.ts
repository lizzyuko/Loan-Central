"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireApplicant } from "@/lib/auth/applicant";
import { PortalError, respondToInformationRequest, submitAccountDetails } from "@/lib/portal/service";
import { logger } from "@/lib/security/logger";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestContext } from "@/lib/security/request";
import { accountDetailsSchema } from "@/lib/validation/account";
import { optionalText } from "@/lib/validation/fields";

export type PortalResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const respondSchema = z.object({
  applicationId: z.uuid(),
  requestId: z.uuid(),
  responseText: optionalText("Response", 2000),
});

async function guard(): Promise<{ applicant: Awaited<ReturnType<typeof requireApplicant>> } | { error: string }> {
  try {
    const applicant = await requireApplicant();
    const limited = await rateLimit("portalActionByApplicant", applicant.id);
    if (!limited.success) return { error: "Too many requests. Please wait a few minutes." };
    return { applicant };
  } catch {
    return { error: "Your session has expired. Please sign in again." };
  }
}

export async function respondToRequestAction(raw: unknown): Promise<PortalResult> {
  const g = await guard();
  if ("error" in g) return { ok: false, error: g.error };
  const parsed = respondSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid response." };
  try {
    await respondToInformationRequest(g.applicant, parsed.data.applicationId, parsed.data.requestId, parsed.data.responseText);
    revalidatePath(`/portal/applications/${parsed.data.applicationId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof PortalError) return { ok: false, error: err.message };
    logger.error("Info response failed", { err });
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function submitAccountDetailsAction(raw: unknown): Promise<PortalResult> {
  const g = await guard();
  if ("error" in g) return { ok: false, error: g.error };
  const parsed = accountDetailsSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }
  try {
    const ctx = await getRequestContext();
    await submitAccountDetails(g.applicant, parsed.data, ctx.ipHash);
    revalidatePath(`/portal/applications/${parsed.data.applicationId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof PortalError) return { ok: false, error: err.message };
    // Never log the payload.
    logger.error("Account details submission failed", { errName: err instanceof Error ? err.name : "unknown" });
    return { ok: false, error: "We couldn't save your details. Please try again." };
  }
}
