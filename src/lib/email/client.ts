import "server-only";
import { Resend } from "resend";
import { emailConsoleFallbackEnabled, isProduction, resendConfig, ConfigurationError } from "@/lib/env";
import { logger } from "@/lib/security/logger";
import type { DeliveryStatus } from "@/db/schema/enums";
import type { EmailContent } from "./layout";

export interface SendResult {
  status: Extract<DeliveryStatus, "SENT" | "FAILED" | "SKIPPED">;
  providerMessageId?: string;
  errorCode?: string;
}

let client: Resend | null = null;

function getClient(): Resend {
  if (!client) client = new Resend(resendConfig().RESEND_API_KEY);
  return client;
}

/** Test hook: replace the transport (e.g. in unit tests). */
export type Transport = (msg: { to: string; email: EmailContent; idempotencyKey?: string }) => Promise<SendResult>;
let transportOverride: Transport | null = null;
export function __setTransport(t: Transport | null) {
  transportOverride = t;
}

/**
 * Send one transactional email. Never throws: returns a delivery status so
 * callers can record it. Message bodies are never logged.
 */
export async function sendEmail(to: string, email: EmailContent, idempotencyKey?: string): Promise<SendResult> {
  if (transportOverride) return transportOverride({ to, email, idempotencyKey });

  if (emailConsoleFallbackEnabled()) {
    // DEVELOPMENT ONLY (refused in production by env.ts): lets you sign in
    // locally before Resend is configured.
    console.log(
      `\n──── [DEV EMAIL, not sent] ────\nTo: ${to}\nSubject: ${email.subject}\n\n${email.text}\n──────────────────────────────\n`,
    );
    return { status: "SKIPPED", errorCode: "dev_console" };
  }

  let cfg: ReturnType<typeof resendConfig>;
  try {
    cfg = resendConfig();
  } catch (err) {
    if (err instanceof ConfigurationError) {
      logger.error("Email not configured", { subject: email.subject });
      return { status: "FAILED", errorCode: "not_configured" };
    }
    throw err;
  }

  try {
    const { data, error } = await getClient().emails.send(
      {
        from: cfg.RESEND_FROM_EMAIL,
        to: [to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        replyTo: cfg.RESEND_REPLY_TO,
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );
    if (error) {
      logger.error("Email send failed", { subject: email.subject, errorName: error.name });
      return { status: "FAILED", errorCode: error.name ?? "send_failed" };
    }
    return { status: "SENT", providerMessageId: data?.id };
  } catch (err) {
    logger.error("Email transport error", { subject: email.subject, err: isProduction ? undefined : err });
    return { status: "FAILED", errorCode: "transport_error" };
  }
}
