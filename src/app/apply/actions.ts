"use server";

import { after } from "next/server";
import { submitApplication } from "@/lib/application/submit";
import { notifyApplicationSubmitted } from "@/lib/application/notifications";
import type { SubmitApplicationResult } from "@/lib/application/submit-types";
import { logger } from "@/lib/security/logger";
import { getRequestContext } from "@/lib/security/request";
import { clearDraftCookie, getDraftTokenHash } from "@/lib/uploads/draft";

/** Public server action behind the application wizard's submit button. */
export async function submitApplicationAction(input: unknown): Promise<SubmitApplicationResult> {
  try {
    const [ctx, draftTokenHash] = await Promise.all([getRequestContext(), getDraftTokenHash()]);
    const outcome = await submitApplication(input, { ctx, draftTokenHash });

    if (outcome.created) {
      const created = outcome.created;
      await clearDraftCookie();
      // Send emails after the response so the applicant isn't kept waiting.
      after(() => notifyApplicationSubmitted(created));
    }
    return outcome.result;
  } catch (err) {
    logger.error("Unexpected submission error", { err });
    return {
      ok: false,
      error: "Something went wrong on our side. Your application was not submitted. Please try again shortly.",
      resetTurnstile: true,
    };
  }
}
