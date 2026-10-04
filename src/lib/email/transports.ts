import "server-only";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import type { EmailContent } from "./layout";

/** Low-level senders. Each throws on failure with a short, non-sensitive code. */

export class TransportError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export interface Message {
  to: string;
  email: EmailContent;
  replyTo: string | null;
  idempotencyKey?: string;
}

export async function sendViaResend(cfg: { apiKey: string; from: string }, msg: Message): Promise<string | undefined> {
  const { data, error } = await new Resend(cfg.apiKey).emails.send(
    {
      from: cfg.from,
      to: [msg.to],
      subject: msg.email.subject,
      html: msg.email.html,
      text: msg.email.text,
      replyTo: msg.replyTo ?? undefined,
    },
    msg.idempotencyKey ? { idempotencyKey: msg.idempotencyKey } : undefined,
  );
  if (error) throw new TransportError(`resend_${error.name ?? "error"}`);
  return data?.id;
}

export async function sendViaZoho(cfg: { host: string; port: number; user: string; password: string; from: string }, msg: Message): Promise<string | undefined> {
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465, // 465 = implicit TLS; 587 = STARTTLS
    requireTLS: cfg.port === 587,
    auth: { user: cfg.user, pass: cfg.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  try {
    const info = await transport.sendMail({
      from: cfg.from,
      to: msg.to,
      subject: msg.email.subject,
      html: msg.email.html,
      text: msg.email.text,
      replyTo: msg.replyTo ?? undefined,
    });
    return info.messageId;
  } catch (err) {
    const e = err as { code?: string; responseCode?: number };
    // EAUTH = wrong username/app password; 553/550 = from address not allowed for this mailbox.
    throw new TransportError(`zoho_${e.code ?? e.responseCode ?? "error"}`);
  } finally {
    transport.close();
  }
}
