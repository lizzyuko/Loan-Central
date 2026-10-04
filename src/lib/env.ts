import "server-only";
import { z } from "zod";

/**
 * Server environment, validated lazily per service so the app can boot (and
 * build) while individual integrations are still being configured. Accessing a
 * service whose variables are missing throws a descriptive error at the point
 * of use — never at import time.
 */

const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const raw = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  RESEND_REPLY_TO: process.env.RESEND_REPLY_TO,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  DEV_EMAIL_CONSOLE: process.env.DEV_EMAIL_CONSOLE,
};

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: optional,
  DATABASE_URL: optional,
  SESSION_SECRET: optional,
  ENCRYPTION_KEY: optional,
  CRON_SECRET: optional,
  ADMIN_EMAILS: optional,
  RESEND_API_KEY: optional,
  RESEND_FROM_EMAIL: optional,
  RESEND_REPLY_TO: optional,
  CLOUDINARY_CLOUD_NAME: optional,
  CLOUDINARY_API_KEY: optional,
  CLOUDINARY_API_SECRET: optional,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optional,
  TURNSTILE_SECRET_KEY: optional,
  UPSTASH_REDIS_REST_URL: optional,
  UPSTASH_REDIS_REST_TOKEN: optional,
  DEV_EMAIL_CONSOLE: optional,
});

const env = schema.parse(raw);

export class ConfigurationError extends Error {
  constructor(service: string, missing: string[]) {
    super(`${service} is not configured. Missing: ${missing.join(", ")}`);
    this.name = "ConfigurationError";
  }
}

function need<K extends keyof typeof env>(service: string, keys: K[]) {
  const missing = keys.filter((k) => !env[k]);
  if (missing.length > 0) throw new ConfigurationError(service, missing as string[]);
  return Object.fromEntries(keys.map((k) => [k, env[k] as string])) as {
    [P in K]: string;
  };
}

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";

export function appUrl(): string {
  const url = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return url.replace(/\/+$/, "");
}

export function databaseConfig() {
  return need("Database", ["DATABASE_URL"]);
}

export function sessionSecret(): Buffer {
  const { SESSION_SECRET } = need("Sessions", ["SESSION_SECRET"]);
  const key = Buffer.from(SESSION_SECRET, "base64");
  if (key.length < 32) {
    throw new ConfigurationError("Sessions", ["SESSION_SECRET (must be ≥32 bytes, base64)"]);
  }
  return key;
}

export function encryptionKey(): Buffer {
  const { ENCRYPTION_KEY } = need("Encryption", ["ENCRYPTION_KEY"]);
  const key = Buffer.from(ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new ConfigurationError("Encryption", ["ENCRYPTION_KEY (must be exactly 32 bytes, base64)"]);
  }
  return key;
}

export function cronSecret(): string | undefined {
  return env.CRON_SECRET;
}

export function bootstrapAdminEmails(): string[] {
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function resendConfig() {
  const cfg = need("Email (Resend)", ["RESEND_API_KEY", "RESEND_FROM_EMAIL"]);
  return { ...cfg, RESEND_REPLY_TO: env.RESEND_REPLY_TO };
}

/** Dev-only escape hatch: print emails to the console when Resend isn't configured. */
export function emailConsoleFallbackEnabled(): boolean {
  return isDevelopment && !env.RESEND_API_KEY && env.DEV_EMAIL_CONSOLE === "true";
}

export function cloudinaryConfig() {
  return need("Documents (Cloudinary)", [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ]);
}

export function turnstileSecret(): string {
  return need("Turnstile", ["TURNSTILE_SECRET_KEY"]).TURNSTILE_SECRET_KEY;
}

export function upstashConfig() {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;
  return { url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN };
}
