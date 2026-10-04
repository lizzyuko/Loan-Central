import { describe, expect, it, vi } from "vitest";
import { decrypt, encrypt, generateNumericCode, hmac, safeEqual } from "@/lib/security/crypto";
import { __test as loggerTest } from "@/lib/security/logger";
import { windowStart } from "@/lib/security/rate-limit";
import { hashPassword, newPasswordSchema, verifyPassword } from "@/lib/auth/password";
import { safeRedirectPath } from "@/lib/security/request";
import { hashCode } from "@/lib/auth/codes";
import { verifyTurnstile } from "@/lib/turnstile/verify";
import { checkFile, sanitizeFilename } from "@/lib/validation/upload";
import { accountDetailsSchema, isValidIbanChecksum } from "@/lib/validation/account";
import { escapeHtml } from "@/lib/email/layout";
import { accountDetailsRequestEmail, generalMessageEmail, verificationEmail } from "@/lib/email/templates";

vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));

describe("encryption", () => {
  it("round-trips and uses a fresh IV each time", () => {
    const a = encrypt("GB82WEST12345698765432");
    const b = encrypt("GB82WEST12345698765432");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("GB82WEST12345698765432");
  });

  it("detects tampering", () => {
    const parts = encrypt("secret").split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });
});

describe("verification codes", () => {
  it("are 6 digits and hashed with a server key, bound to user and kind", () => {
    const code = generateNumericCode();
    expect(code).toMatch(/^\d{6}$/);
    const h = hashCode("applicant", "user-1", code);
    expect(h).not.toContain(code);
    expect(hashCode("applicant", "user-2", code)).not.toBe(h);
    expect(safeEqual(h, hashCode("applicant", "user-1", code))).toBe(true);
  });

  it("hmac differs by purpose", () => {
    expect(hmac("a", "x")).not.toBe(hmac("b", "x"));
  });
});

describe("logger redaction", () => {
  it("redacts sensitive keys recursively", () => {
    const out = loggerTest.redact({ code: "123456", nested: { iban: "GB..", ok: 1 }, token: "abc" }) as Record<string, unknown>;
    expect(out.code).toBe("[redacted]");
    expect(out.token).toBe("[redacted]");
    expect((out.nested as Record<string, unknown>).iban).toBe("[redacted]");
    expect((out.nested as Record<string, unknown>).ok).toBe(1);
  });
});

describe("rate limiting windows", () => {
  it("buckets timestamps into fixed windows", () => {
    const w = 15 * 60;
    const t = Date.UTC(2026, 9, 4, 10, 7, 30);
    expect(windowStart(t, w)).toBe(Date.UTC(2026, 9, 4, 10, 0, 0));
    expect(windowStart(t + 8 * 60_000, w)).toBe(Date.UTC(2026, 9, 4, 10, 15, 0));
  });
});

describe("passwords", () => {
  it("hashes with a random salt and verifies", async () => {
    const a = await hashPassword("correct horse battery staple");
    const b = await hashPassword("correct horse battery staple");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(a).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery staple", a)).toBe(true);
    expect(await verifyPassword("Correct horse battery staple", a)).toBe(false);
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
  });

  it("enforces the password policy", () => {
    expect(newPasswordSchema.safeParse("short").success).toBe(false);
    expect(newPasswordSchema.safeParse("aaaaaaaaaaaaaaaa").success).toBe(false);
    expect(newPasswordSchema.safeParse("password1234").success).toBe(false);
    expect(newPasswordSchema.safeParse("river-lantern-copper-71").success).toBe(true);
  });
});

describe("redirects", () => {
  it("only allows same-site relative paths", () => {
    expect(safeRedirectPath("/portal/applications/x", "/portal")).toBe("/portal/applications/x");
    expect(safeRedirectPath("//evil.com", "/portal")).toBe("/portal");
    expect(safeRedirectPath("https://evil.com", "/portal")).toBe("/portal");
    expect(safeRedirectPath("/\\evil.com", "/portal")).toBe("/portal");
  });
});

describe("turnstile verification", () => {
  const ok = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;

  it("rejects a missing token without calling Cloudflare", async () => {
    const f = ok({ success: true });
    expect(await verifyTurnstile({ token: "", action: "apply", fetchImpl: f, secret: "s" })).toEqual({ success: false, reason: "missing" });
    expect(f).not.toHaveBeenCalled();
  });

  it("accepts a valid response", async () => {
    expect((await verifyTurnstile({ token: "t", action: "apply", fetchImpl: ok({ success: true, action: "apply" }), secret: "s" })).success).toBe(true);
  });

  it("rejects failures and action mismatches", async () => {
    expect((await verifyTurnstile({ token: "t", action: "apply", fetchImpl: ok({ success: false }), secret: "s" })).reason).toBe("invalid");
    expect((await verifyTurnstile({ token: "t", action: "apply", fetchImpl: ok({ success: true, action: "admin_login" }), secret: "s" })).reason).toBe("action_mismatch");
  });

  it("fails closed when Cloudflare is unreachable", async () => {
    const failing = vi.fn(async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    expect(await verifyTurnstile({ token: "t", action: "apply", fetchImpl: failing, secret: "s" })).toEqual({ success: false, reason: "unavailable" });
  });
});

describe("upload validation", () => {
  it("accepts allowed documents", () => {
    expect(checkFile({ filename: "passport.pdf", bytes: 2000, mimeType: "application/pdf" }).ok).toBe(true);
    expect(checkFile({ filename: "photo.HEIC", bytes: 2000, mimeType: "" }).ok).toBe(true);
  });

  it("rejects dangerous, disguised, oversized and empty files", () => {
    expect(checkFile({ filename: "invoice.exe", bytes: 10 }).ok).toBe(false);
    expect(checkFile({ filename: "scan.pdf.exe", bytes: 10 }).ok).toBe(false);
    expect(checkFile({ filename: "scan.exe.pdf", bytes: 10 }).ok).toBe(false);
    expect(checkFile({ filename: "drawing.svg", bytes: 10 }).ok).toBe(false);
    expect(checkFile({ filename: "a.pdf", bytes: 11 * 1024 * 1024 }).ok).toBe(false);
    expect(checkFile({ filename: "a.pdf", bytes: 0 }).ok).toBe(false);
    expect(checkFile({ filename: "a.pdf", bytes: 10, mimeType: "text/html" }).ok).toBe(false);
  });

  it("sanitises filenames", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename('C:\\Users\\me\\<bad>"name".pdf')).toBe("badname.pdf");
  });
});

describe("account details validation", () => {
  const base = { applicationId: "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e", accountHolderName: "Lukas Brandt", bankName: "Example Bank", confirm: true as const };

  it("validates IBAN checksums", () => {
    expect(isValidIbanChecksum("DE89370400440532013000")).toBe(true);
    expect(isValidIbanChecksum("DE89370400440532013001")).toBe(false);
  });

  it("uses country-specific identifiers", () => {
    const de = accountDetailsSchema.safeParse({ ...base, country: "DE", currency: "EUR", identifiers: { iban: "DE89 3704 0044 0532 0130 00" } });
    expect(de.success).toBe(true);
    expect(de.data?.identifiers.iban).toBe("DE89370400440532013000");

    const us = accountDetailsSchema.safeParse({ ...base, country: "US", currency: "USD", identifiers: { routingNumber: "021000021", accountNumber: "123456789" } });
    expect(us.success).toBe(true);

    const gbMissing = accountDetailsSchema.safeParse({ ...base, country: "GB", currency: "GBP", identifiers: { accountNumber: "12345678" } });
    expect(gbMissing.success).toBe(false);
  });

  it("rejects identifiers that don't belong to the country's scheme", () => {
    const r = accountDetailsSchema.safeParse({ ...base, country: "US", currency: "USD", identifiers: { routingNumber: "021000021", accountNumber: "1234", iban: "DE89370400440532013000" } });
    expect(r.success).toBe(false);
  });
});

describe("email templates", () => {
  it("escape dynamic content", () => {
    expect(escapeHtml('<img src=x onerror="a">')).toBe("&lt;img src=x onerror=&quot;a&quot;&gt;");
    const email = generalMessageEmail({ firstName: "<b>Eve</b>", reference: "LC-2026-123456", subject: "Hi", message: "<script>alert(1)</script>", portalUrl: "https://x.test/portal" });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("use the required subjects", () => {
    expect(verificationEmail({ code: "123456", link: "https://x", minutes: 10 }).subject).toBe("Your Loan Central verification code");
    expect(accountDetailsRequestEmail({ firstName: "A", reference: "LC-2026-111111", portalUrl: "https://x" }).subject).toBe("Next step for your Loan Central application");
  });

  it("never ask for bank details by email", () => {
    const e = accountDetailsRequestEmail({ firstName: "A", reference: "LC-2026-111111", portalUrl: "https://x" });
    expect(e.text).toMatch(/Never send bank details by email/);
  });
});
