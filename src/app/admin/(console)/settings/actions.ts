"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { AuthError, requireAdmin } from "@/lib/auth/admin";
import type { Permission } from "@/lib/auth/permissions";
import { createAdmin, saveDocumentType, saveProduct, SettingsError, updateAdmin } from "@/lib/admin/settings";
import { logger } from "@/lib/security/logger";
import { adminCreateSchema, adminUpdateSchema, documentTypeSchema, productSchema } from "@/lib/validation/settings";

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
    logger.error("Settings action failed", { err });
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function createAdminAction(raw: unknown) {
  return run("admins.manage", adminCreateSchema, raw, "/admin/settings/admins", async (a, i) => {
    await createAdmin(a, i);
    return "Administrator added. They can now sign in with their email.";
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
