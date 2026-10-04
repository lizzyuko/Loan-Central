import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { systemSettings } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/security/crypto";
import { logger } from "@/lib/security/logger";

/**
 * Email provider configuration, editable by super admins in
 * Settings → Email. Secrets (Resend API key, Zoho password) are stored
 * encrypted with ENCRYPTION_KEY and never returned to the browser.
 */

export const EMAIL_PROVIDERS = ["resend", "zoho"] as const;
export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];

export const ZOHO_HOSTS = [
  { value: "smtp.zoho.com", label: "Zoho Mail (zoho.com)" },
  { value: "smtp.zoho.eu", label: "Zoho Mail EU (zoho.eu)" },
  { value: "smtp.zoho.in", label: "Zoho Mail India (zoho.in)" },
  { value: "smtp.zoho.com.au", label: "Zoho Mail Australia (zoho.com.au)" },
  { value: "smtppro.zoho.com", label: "Zoho Workplace / custom domain (smtppro.zoho.com)" },
  { value: "smtppro.zoho.eu", label: "Zoho Workplace EU (smtppro.zoho.eu)" },
  { value: "smtppro.zoho.in", label: "Zoho Workplace India (smtppro.zoho.in)" },
] as const;

const SETTINGS_KEY = "email";

/** Stored shape (secrets encrypted). */
const storedSchema = z.object({
  activeProvider: z.enum(EMAIL_PROVIDERS).nullable().default(null),
  fallbackEnabled: z.boolean().default(true),
  replyTo: z.string().nullable().default(null),
  resend: z
    .object({ apiKeyEnc: z.string().nullable().default(null), apiKeyHint: z.string().nullable().default(null), from: z.string().nullable().default(null) })
    .default({ apiKeyEnc: null, apiKeyHint: null, from: null }),
  zoho: z
    .object({
      host: z.string().default("smtp.zoho.com"),
      port: z.number().int().default(465),
      user: z.string().nullable().default(null),
      passwordEnc: z.string().nullable().default(null),
      passwordHint: z.string().nullable().default(null),
      from: z.string().nullable().default(null),
    })
    .default({ host: "smtp.zoho.com", port: 465, user: null, passwordEnc: null, passwordHint: null, from: null }),
});
type Stored = z.infer<typeof storedSchema>;

/** Decrypted runtime config (server only). */
export interface EmailRuntimeConfig {
  activeProvider: EmailProvider | null;
  fallbackEnabled: boolean;
  replyTo: string | null;
  resend: { apiKey: string; from: string } | null;
  zoho: { host: string; port: number; user: string; password: string; from: string } | null;
}

/** Safe-for-browser view of the settings (no secrets). */
export interface EmailSettingsView {
  activeProvider: EmailProvider | null;
  fallbackEnabled: boolean;
  replyTo: string;
  resend: { configured: boolean; apiKeyHint: string | null; from: string };
  zoho: { configured: boolean; host: string; port: number; user: string; passwordHint: string | null; from: string };
  updatedAt: Date | null;
}

async function loadStored(): Promise<{ stored: Stored; updatedAt: Date | null }> {
  const [row] = await getDb().select().from(systemSettings).where(eq(systemSettings.key, SETTINGS_KEY)).limit(1);
  const parsed = storedSchema.safeParse(row?.value ?? {});
  return { stored: parsed.success ? parsed.data : storedSchema.parse({}), updatedAt: row?.updatedAt ?? null };
}

function safeDecrypt(value: string | null): string | null {
  if (!value) return null;
  try {
    return decrypt(value);
  } catch (err) {
    logger.error("Could not decrypt email secret (was ENCRYPTION_KEY changed?)", { err });
    return null;
  }
}

/** Cached briefly so a burst of emails doesn't hit the DB each time. */
let cache: { at: number; config: EmailRuntimeConfig } | null = null;
const CACHE_MS = 30_000;

export async function getEmailRuntimeConfig(): Promise<EmailRuntimeConfig | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.config;
  try {
    const { stored } = await loadStored();
    const apiKey = safeDecrypt(stored.resend.apiKeyEnc);
    const password = safeDecrypt(stored.zoho.passwordEnc);
    const config: EmailRuntimeConfig = {
      activeProvider: stored.activeProvider,
      fallbackEnabled: stored.fallbackEnabled,
      replyTo: stored.replyTo,
      resend: apiKey && stored.resend.from ? { apiKey, from: stored.resend.from } : null,
      zoho:
        password && stored.zoho.user && stored.zoho.from
          ? { host: stored.zoho.host, port: stored.zoho.port, user: stored.zoho.user, password, from: stored.zoho.from }
          : null,
    };
    cache = { at: Date.now(), config };
    return config;
  } catch (err) {
    logger.error("Failed to load email settings", { err });
    return null;
  }
}

export function clearEmailConfigCache() {
  cache = null;
}

export async function getEmailSettingsView(): Promise<EmailSettingsView> {
  const { stored, updatedAt } = await loadStored();
  return {
    activeProvider: stored.activeProvider,
    fallbackEnabled: stored.fallbackEnabled,
    replyTo: stored.replyTo ?? "",
    resend: { configured: Boolean(stored.resend.apiKeyEnc && stored.resend.from), apiKeyHint: stored.resend.apiKeyHint, from: stored.resend.from ?? "" },
    zoho: {
      configured: Boolean(stored.zoho.passwordEnc && stored.zoho.user && stored.zoho.from),
      host: stored.zoho.host,
      port: stored.zoho.port,
      user: stored.zoho.user ?? "",
      passwordHint: stored.zoho.passwordHint,
      from: stored.zoho.from ?? "",
    },
    updatedAt,
  };
}

function hint(secret: string): string {
  return `••••${secret.slice(-4)}`;
}

const fromAddress = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === "" || /^(.+<\s*[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+\s*>|[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)$/.test(v), {
    error: 'Use an address like noreply@yourdomain.com or "Loan Central <noreply@yourdomain.com>"',
  });

export const emailSettingsInputSchema = z
  .object({
    activeProvider: z.enum(EMAIL_PROVIDERS).nullable(),
    fallbackEnabled: z.boolean(),
    replyTo: z.union([z.literal(""), z.email({ error: "Reply-to must be an email address" })]),
    resendFrom: fromAddress,
    /** Empty = keep the existing key. */
    resendApiKey: z
      .string()
      .trim()
      .max(200)
      .refine((v) => v === "" || v.startsWith("re_"), { error: "Resend API keys start with re_" }),
    zohoHost: z.enum(ZOHO_HOSTS.map((h) => h.value) as [string, ...string[]]),
    zohoPort: z.union([z.literal(465), z.literal(587)]),
    zohoUser: z.union([z.literal(""), z.email({ error: "Zoho username is your full Zoho email address" })]),
    zohoFrom: fromAddress,
    /** Empty = keep the existing password. */
    zohoPassword: z.string().max(200),
  })
  .refine((v) => v.activeProvider !== "resend" || v.resendFrom !== "", { path: ["resendFrom"], error: "Set a from address for Resend" })
  .refine((v) => v.activeProvider !== "zoho" || (v.zohoUser !== "" && v.zohoFrom !== ""), { path: ["zohoUser"], error: "Set the Zoho username and from address" });

export type EmailSettingsInput = z.output<typeof emailSettingsInputSchema>;

/** Saves settings and returns the provider that ends up active. */
export async function saveEmailSettings(input: EmailSettingsInput, adminId: string): Promise<EmailProvider | null> {
  const { stored } = await loadStored();
  const next: Stored = {
    activeProvider: input.activeProvider,
    fallbackEnabled: input.fallbackEnabled,
    replyTo: input.replyTo || null,
    resend: {
      apiKeyEnc: input.resendApiKey ? encrypt(input.resendApiKey) : stored.resend.apiKeyEnc,
      apiKeyHint: input.resendApiKey ? hint(input.resendApiKey) : stored.resend.apiKeyHint,
      from: input.resendFrom || null,
    },
    zoho: {
      host: input.zohoHost,
      port: input.zohoPort,
      user: input.zohoUser || null,
      passwordEnc: input.zohoPassword ? encrypt(input.zohoPassword) : stored.zoho.passwordEnc,
      passwordHint: input.zohoPassword ? hint(input.zohoPassword) : stored.zoho.passwordHint,
      from: input.zohoFrom || null,
    },
  };
  // Nothing selected but exactly one provider is set up: use it.
  const resendReady = Boolean(next.resend.apiKeyEnc && next.resend.from);
  const zohoReady = Boolean(next.zoho.passwordEnc && next.zoho.user && next.zoho.from);
  if (!next.activeProvider && resendReady !== zohoReady) next.activeProvider = resendReady ? "resend" : "zoho";

  if (next.activeProvider === "resend" && !next.resend.apiKeyEnc) throw new Error("Add a Resend API key before selecting Resend.");
  if (next.activeProvider === "zoho" && !next.zoho.passwordEnc) throw new Error("Add the Zoho app password before selecting Zoho.");

  await getDb()
    .insert(systemSettings)
    .values({ key: SETTINGS_KEY, value: next, updatedByAdminId: adminId })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value: next, updatedByAdminId: adminId, updatedAt: new Date() } });
  clearEmailConfigCache();
  return next.activeProvider;
}

/** Remove a provider's stored secret entirely. */
export async function clearProviderSecret(provider: EmailProvider, adminId: string): Promise<void> {
  const { stored } = await loadStored();
  if (provider === "resend") stored.resend = { apiKeyEnc: null, apiKeyHint: null, from: stored.resend.from };
  else stored.zoho = { ...stored.zoho, passwordEnc: null, passwordHint: null };
  if (stored.activeProvider === provider) stored.activeProvider = null;
  await getDb()
    .insert(systemSettings)
    .values({ key: SETTINGS_KEY, value: stored, updatedByAdminId: adminId })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value: stored, updatedByAdminId: adminId, updatedAt: new Date() } });
  clearEmailConfigCache();
}
