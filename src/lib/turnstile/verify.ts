import "server-only";
import { z } from "zod";
import { turnstileSecret } from "@/lib/env";
import { logger } from "@/lib/security/logger";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const responseSchema = z.object({
  success: z.boolean(),
  "error-codes": z.array(z.string()).optional(),
  action: z.string().optional(),
  hostname: z.string().optional(),
});

export type TurnstileAction = "apply" | "admin_login" | "portal_login";

export interface TurnstileResult {
  success: boolean;
  reason?: "missing" | "invalid" | "action_mismatch" | "unavailable";
}

interface VerifyOptions {
  token: string | null | undefined;
  action: TurnstileAction;
  remoteIp?: string | null;
  /** Injected for tests. */
  fetchImpl?: typeof fetch;
  secret?: string;
}

/** Server-side Turnstile verification. Always call before trusting a request. */
export async function verifyTurnstile({
  token,
  action,
  remoteIp,
  fetchImpl = fetch,
  secret,
}: VerifyOptions): Promise<TurnstileResult> {
  if (!token || token.length > 2048) return { success: false, reason: "missing" };

  const body = new URLSearchParams({ secret: secret ?? turnstileSecret(), response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  let json: unknown;
  try {
    const res = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    json = await res.json();
  } catch (err) {
    logger.error("Turnstile verification unavailable", { err });
    return { success: false, reason: "unavailable" };
  }

  const parsed = responseSchema.safeParse(json);
  if (!parsed.success || !parsed.data.success) {
    return { success: false, reason: "invalid" };
  }
  // Test keys return no action / "test"; real widgets echo the action we set.
  if (parsed.data.action && parsed.data.action !== "test" && parsed.data.action !== action) {
    return { success: false, reason: "action_mismatch" };
  }
  return { success: true };
}
