import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { encryptionKey, sessionSecret } from "@/lib/env";

/** 256-bit URL-safe random token. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Uniformly random numeric code, zero-padded (e.g. "048213"). */
export function generateNumericCode(digits = 6): string {
  return randomInt(0, 10 ** digits).toString().padStart(digits, "0");
}

/** SHA-256 for high-entropy secrets (session tokens, link tokens). */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Keyed hash for low-entropy secrets (6-digit codes) and identifiers.
 * The server-side key prevents offline brute force if the DB leaks.
 */
export function hmac(purpose: string, ...parts: string[]): string {
  return createHmac("sha256", sessionSecret())
    .update([purpose, ...parts].join("|"))
    .digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Pseudonymous IP fingerprint for audit/rate-limit records. */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return hmac("ip", ip).slice(0, 32);
}

// --- AES-256-GCM field encryption -----------------------------------------

const ALGO = "aes-256-gcm";
export const CURRENT_KEY_VERSION = 1;

/** Returns "v1.<iv>.<tag>.<ciphertext>" (base64url parts). */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [`v${CURRENT_KEY_VERSION}`, iv, tag, ciphertext]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(".");
}

export function decrypt(payload: string): string {
  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== `v${CURRENT_KEY_VERSION}` || !iv || !tag || !ciphertext) {
    throw new Error("Unsupported encrypted payload");
  }
  const decipher = createDecipheriv(ALGO, encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
