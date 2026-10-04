"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { sendTestEmail } from "@/lib/email/client";
import { clearProviderSecret, EMAIL_PROVIDERS, emailSettingsInputSchema, saveEmailSettings } from "@/lib/email/settings";
import { testEmail } from "@/lib/email/templates";
import { saveLoanSettings } from "@/lib/loans/settings";
import { loanSettingsSchema } from "@/lib/validation/loans";
import { AuthError, requireAdmin } from "@/lib/auth/admin";
import type { Permission } from "@/lib/auth/permissions";
import { createAdmin, resendInvite, saveDocumentType, saveProduct, SettingsError, updateAdmin } from "@/lib/admin/settings";
import { ConfigurationError } from "@/lib/env";
import { logger } from "@/lib/security/logger";
import { adminCreateSchema, adminIdSchema, adminUpdateSchema, documentTypeSchema, productSchema } from "@/lib/validation/settings";

const providerSchema = z.object({ provider: z.enum(EMAIL_PROVIDERS) });

export type SettingsResult = { ok: true; message: string } | { ok: false; error: string };

async function run<S extends z.ZodType>(
  permission: Permission,
  schema: S,
  raw: unknown,
  path: string,
  fn: (admin: Awaited<ReturnType<typeof requireAdmin>>, input: z.output<S>) => Promise<string>,
): Promise<SettingsResult> {
  try {
    const admin = await requireAdmin(permission);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    const message = await fn(admin, parsed.data);
    revalidatePath(path);
    return { ok: true, message };
  } catch (err) {
    if (err instanceof AuthError || err instanceof SettingsError) return { ok: false, error: err.message };
    if (err instanceof ConfigurationError) {
      logger.error("Settings action blocked by server configuration", { message: err.message });
      return {
        ok: false,
        error: /ENCRYPTION_KEY/.test(err.message)
          ? "The server's ENCRYPTION_KEY is missing or invalid, so credentials can't be stored securely. Add a 32-byte base64 ENCRYPTION_KEY in Vercel's environment variables, redeploy, then try again."
          : `Server configuration problem: ${err.message}`,
      };
    }
    logger.error("Settings action failed", { err });
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function createAdminAction(raw: unknown) {
  return run("admins.manage", adminCreateSchema, raw, "/admin/settings/admins", async (a, i) => {
    const status = await createAdmin(a, i);
    return status === "SENT" ? `Invitation sent to ${i.email}.` : "Administrator added, but the invitation email could not be sent. Use \"Resend invite\" once email is configured.";
  });
}

export async function resendInviteAction(raw: unknown) {
  return run("admins.manage", adminIdSchema, raw, "/admin/settings/admins", async (a, i) => {
    const status = await resendInvite(a, i.adminId);
    return status === "SENT" ? "Invitation re-sent." : "The invitation email could not be sent. Check the email configuration.";
  });
}

export async function updateAdminAction(raw: unknown) {
  return run("admins.manage", adminUpdateSchema, raw, "/admin/settings/admins", async (a, i) => {
    await updateAdmin(a, i);
    return "Administrator updated.";
  });
}

export async function saveProductAction(raw: unknown) {
  return run("products.manage", productSchema, raw, "/admin/settings/products", async (a, i) => {
    await saveProduct(a, i);
    revalidatePath("/");
    return "Product saved.";
  });
}

export async function saveDocumentTypeAction(raw: unknown) {
  return run("documents.configure", documentTypeSchema, raw, "/admin/settings/documents", async (a, i) => {
    await saveDocumentType(a, i);
    return "Document type saved.";
  });
}

// --- Email providers & loan settings --------------------------------------------------

export async function saveEmailSettingsAction(raw: unknown) {
  return run("settings.manage", emailSettingsInputSchema, raw, "/admin/settings/email", async (a, i) => {
    let active: string | null;
    try {
      active = await saveEmailSettings(i, a.id);
    } catch (err) {
      if (err instanceof Error && /before selecting/.test(err.message)) throw new SettingsError(err.message);
      throw err;
    }
    await recordAudit({ actor: { type: "ADMIN", adminId: a.id }, action: "settings.email_updated", metadata: { activeProvider: i.activeProvider, fallback: i.fallbackEnabled } });
    if (!active) return "Email settings saved. No provider is active yet: select Resend or Zoho under Sending to start sending email.";
    return `Email settings saved. ${active === "zoho" ? "Zoho Mail" : "Resend"} is the active provider.`;
  });
}

export async function testEmailAction(raw: unknown) {
  return run("settings.manage", providerSchema, raw, "/admin/settings/email", async (a, i) => {
    const res = await sendTestEmail(i.provider, a.email, testEmail({ provider: i.provider === "zoho" ? "Zoho Mail" : "Resend", adminName: a.name }));
    await recordAudit({ actor: { type: "ADMIN", adminId: a.id }, action: "settings.email_tested", metadata: { provider: i.provider, status: res.status, errorCode: res.errorCode } });
    if (res.status !== "SENT") throw new SettingsError(explainEmailError(i.provider, res.errorCode));
    return `Test email sent to ${a.email} via ${i.provider === "zoho" ? "Zoho" : "Resend"}.`;
  });
}

export async function clearProviderAction(raw: unknown) {
  return run("settings.manage", providerSchema, raw, "/admin/settings/email", async (a, i) => {
    await clearProviderSecret(i.provider, a.id);
    await recordAudit({ actor: { type: "ADMIN", adminId: a.id }, action: "settings.email_updated", metadata: { cleared: i.provider } });
    return `${i.provider === "zoho" ? "Zoho" : "Resend"} credentials removed.`;
  });
}

export async function saveLoanSettingsAction(raw: unknown) {
  return run("settings.manage", loanSettingsSchema, raw, "/admin/settings/loans", async (a, i) => {
    await saveLoanSettings(i, a.id);
    await recordAudit({ actor: { type: "ADMIN", adminId: a.id }, action: "settings.loans_updated" });
    return "Loan settings saved.";
  });
}

function explainEmailError(provider: "resend" | "zoho", code?: string): string {
  if (code === "not_configured") return "Save this provider's credentials before sending a test.";
  if (provider === "zoho") {
    if (code === "zoho_EAUTH") return "Zoho rejected the username or password. Use your full Zoho email and an app-specific password.";
    if (code?.startsWith("zoho_55")) return "Zoho refused the from address. It must be your Zoho mailbox or a verified alias.";
    if (code === "zoho_ETIMEDOUT" || code === "zoho_ECONNECTION") return "Couldn't connect to Zoho. Check the host matches your Zoho region.";
    return `Zoho couldn't send the email (${code ?? "unknown error"}).`;
  }
  if (code?.includes("validation") || code?.includes("invalid_from")) return "Resend refused the from address. It must be on a domain verified in Resend.";
  return `Resend couldn't send the email (${code ?? "unknown error"}). Check the API key and that the from domain is verified.`;
}
