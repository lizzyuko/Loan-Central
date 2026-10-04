import "server-only";
import { emailConsoleFallbackEnabled, envResendConfig } from "@/lib/env";
import { logger } from "@/lib/security/logger";
import type { DeliveryStatus } from "@/db/schema/enums";
import type { EmailContent } from "./layout";
import { getEmailRuntimeConfig, type EmailProvider, type EmailRuntimeConfig } from "./settings";
import { sendViaResend, sendViaZoho, TransportError, type Message } from "./transports";

export interface SendResult {
  status: Extract<DeliveryStatus, "SENT" | "FAILED" | "SKIPPED">;
  provider?: EmailProvider;
  providerMessageId?: string;
  errorCode?: string;
}

/** Test hook: replace the transport (e.g. in unit tests). */
export type Transport = (msg: { to: string; email: EmailContent; idempotencyKey?: string }) => Promise<SendResult>;
let transportOverride: Transport | null = null;
export function __setTransport(t: Transport | null) {
  transportOverride = t;
}

type Candidate =
  | { provider: "resend"; cfg: { apiKey: string; from: string } }
  | { provider: "zoho"; cfg: NonNullable<EmailRuntimeConfig["zoho"]> };

/**
 * Providers to try, in order: the one selected in Settings → Email, then the
 * other one if fallback is on. If nothing is configured in the dashboard, the
 * RESEND_* environment variables are used.
 */
function candidates(config: EmailRuntimeConfig | null): Candidate[] {
  const out: Candidate[] = [];
  const add = (p: EmailProvider) => {
    if (p === "resend" && config?.resend) out.push({ provider: "resend", cfg: config.resend });
    if (p === "zoho" && config?.zoho) out.push({ provider: "zoho", cfg: config.zoho });
  };
  if (config?.activeProvider) {
    add(config.activeProvider);
    if (config.fallbackEnabled) add(config.activeProvider === "resend" ? "zoho" : "resend");
  }
  if (out.length === 0) {
    const env = envResendConfig();
    if (env) out.push({ provider: "resend", cfg: env });
  }
  return out;
}

async function attempt(c: Candidate, msg: Message): Promise<string | undefined> {
  return c.provider === "resend" ? sendViaResend(c.cfg, msg) : sendViaZoho(c.cfg, msg);
}

/**
 * Send one transactional email. Never throws: returns a delivery status so
 * callers can record it. Message bodies are never logged.
 */
export async function sendEmail(to: string, email: EmailContent, idempotencyKey?: string): Promise<SendResult> {
  if (transportOverride) return transportOverride({ to, email, idempotencyKey });

  const config = await getEmailRuntimeConfig();
  const list = candidates(config);

  if (list.length === 0) {
    if (emailConsoleFallbackEnabled()) {
      // DEVELOPMENT ONLY (refused in production by env.ts).
      console.log(`\n──── [DEV EMAIL, not sent] ────\nTo: ${to}\nSubject: ${email.subject}\n\n${email.text}\n──────────────────────────────\n`);
      return { status: "SKIPPED", errorCode: "dev_console" };
    }
    logger.error("No email provider configured", { subject: email.subject });
    return { status: "FAILED", errorCode: "not_configured" };
  }

  const msg: Message = { to, email, replyTo: config?.replyTo ?? envResendConfig()?.replyTo ?? null, idempotencyKey };
  let lastError = "send_failed";
  for (const c of list) {
    try {
      const id = await attempt(c, msg);
      if (lastError !== "send_failed") logger.warn("Email sent via fallback provider", { provider: c.provider, subject: email.subject });
      return { status: "SENT", provider: c.provider, providerMessageId: id };
    } catch (err) {
      lastError = err instanceof TransportError ? err.code : `${c.provider}_transport_error`;
      logger.error("Email provider failed", { provider: c.provider, errorCode: lastError, subject: email.subject });
    }
  }
  return { status: "FAILED", errorCode: lastError };
}

/** Send through one specific saved provider, without fallback (Settings → "Send test email"). */
export async function sendTestEmail(provider: EmailProvider, to: string, email: EmailContent): Promise<SendResult> {
  const config = await getEmailRuntimeConfig();
  const c = provider === "resend" ? (config?.resend ? { provider, cfg: config.resend } : null) : config?.zoho ? { provider, cfg: config.zoho } : null;
  if (!c) return { status: "FAILED", provider, errorCode: "not_configured" };
  try {
    const id = await attempt(c as Candidate, { to, email, replyTo: config?.replyTo ?? null });
    return { status: "SENT", provider, providerMessageId: id };
  } catch (err) {
    return { status: "FAILED", provider, errorCode: err instanceof TransportError ? err.code : "transport_error" };
  }
}
