import { beforeEach, describe, expect, it, vi } from "vitest";

const config = vi.hoisted(() => ({ current: null as unknown }));
const calls = vi.hoisted(() => ({ resend: 0, zoho: 0, failResend: false, failZoho: false }));

vi.mock("@/lib/email/settings", () => ({ getEmailRuntimeConfig: async () => config.current }));
vi.mock("@/lib/email/transports", () => {
  class TransportError extends Error {
    constructor(public code: string) {
      super(code);
    }
  }
  return {
    TransportError,
    sendViaResend: async () => {
      calls.resend++;
      if (calls.failResend) throw new TransportError("resend_error");
      return "resend-id";
    },
    sendViaZoho: async () => {
      calls.zoho++;
      if (calls.failZoho) throw new TransportError("zoho_EAUTH");
      return "zoho-id";
    },
  };
});

const { sendEmail, sendTestEmail } = await import("@/lib/email/client");

const email = { subject: "Hi", html: "<p>Hi</p>", text: "Hi" };
const resend = { apiKey: "re_x", from: "a@b.co" };
const zoho = { host: "smtp.zoho.com", port: 465, user: "u@b.co", password: "p", from: "u@b.co" };

beforeEach(() => {
  Object.assign(calls, { resend: 0, zoho: 0, failResend: false, failZoho: false });
});

describe("email provider selection", () => {
  it("uses the selected provider", async () => {
    config.current = { activeProvider: "zoho", fallbackEnabled: true, replyTo: null, resend, zoho };
    const r = await sendEmail("x@y.co", email);
    expect(r).toMatchObject({ status: "SENT", provider: "zoho", providerMessageId: "zoho-id" });
    expect(calls).toMatchObject({ zoho: 1, resend: 0 });
  });

  it("falls back to the other provider when enabled", async () => {
    config.current = { activeProvider: "zoho", fallbackEnabled: true, replyTo: null, resend, zoho };
    calls.failZoho = true;
    const r = await sendEmail("x@y.co", email);
    expect(r).toMatchObject({ status: "SENT", provider: "resend" });
    expect(calls).toMatchObject({ zoho: 1, resend: 1 });
  });

  it("does not fall back when disabled", async () => {
    config.current = { activeProvider: "zoho", fallbackEnabled: false, replyTo: null, resend, zoho };
    calls.failZoho = true;
    const r = await sendEmail("x@y.co", email);
    expect(r).toMatchObject({ status: "FAILED", errorCode: "zoho_EAUTH" });
    expect(calls.resend).toBe(0);
  });

  it("skips providers that aren't configured", async () => {
    config.current = { activeProvider: "resend", fallbackEnabled: true, replyTo: null, resend, zoho: null };
    calls.failResend = true;
    const r = await sendEmail("x@y.co", email);
    expect(r.status).toBe("FAILED");
    expect(calls.zoho).toBe(0);
  });

  it("test emails use exactly the chosen provider", async () => {
    config.current = { activeProvider: "resend", fallbackEnabled: true, replyTo: null, resend, zoho };
    calls.failZoho = true;
    const r = await sendTestEmail("zoho", "x@y.co", email);
    expect(r).toMatchObject({ status: "FAILED", provider: "zoho" });
    expect(calls.resend).toBe(0);
  });
});
