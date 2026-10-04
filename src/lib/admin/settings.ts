import "server-only";
import { asc, count, desc, eq, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { admins, applications, auditLogs, documentTypes, loanProducts } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import type { CurrentAdmin } from "@/lib/auth/admin";
import { sendInvite } from "@/lib/auth/admin-auth";
import { revokeAllSessions } from "@/lib/auth/session";
import type { adminCreateSchema, adminUpdateSchema, documentTypeSchema, productSchema } from "@/lib/validation/settings";

export class SettingsError extends Error {}

const actor = (a: CurrentAdmin) => ({ type: "ADMIN" as const, adminId: a.id });

// --- Administrators -----------------------------------------------------------

export function listAdmins() {
  return getDb()
    .select({
      id: admins.id,
      email: admins.email,
      name: admins.name,
      role: admins.role,
      isActive: admins.isActive,
      lastLoginAt: admins.lastLoginAt,
      activated: sql<boolean>`${admins.passwordHash} is not null`,
    })
    .from(admins)
    .orderBy(asc(admins.name));
}

/** Creates the admin (no password yet) and emails them an invitation. */
export async function createAdmin(by: CurrentAdmin, input: z.output<typeof adminCreateSchema>): Promise<string> {
  let id: string | undefined;
  try {
    const [row] = await getDb().insert(admins).values({ ...input, invitedByAdminId: by.id }).returning({ id: admins.id });
    id = row?.id;
    await recordAudit({ actor: actor(by), action: "admin.created", targetType: "admin", targetId: id, metadata: { role: input.role } });
  } catch (err) {
    if (isUniqueViolation(err)) throw new SettingsError("An administrator with that email already exists.");
    throw err;
  }
  if (!id) throw new Error("Admin insert failed");
  return sendInvite(id, { id: by.id, name: by.name });
}

export async function resendInvite(by: CurrentAdmin, adminId: string): Promise<string> {
  const [target] = await getDb().select({ passwordHash: admins.passwordHash, isActive: admins.isActive }).from(admins).where(eq(admins.id, adminId));
  if (!target) throw new SettingsError("Administrator not found.");
  if (target.passwordHash) throw new SettingsError("This administrator has already activated their account.");
  if (!target.isActive) throw new SettingsError("Reactivate this administrator before re-sending the invitation.");
  return sendInvite(adminId, { id: by.id, name: by.name });
}

export async function updateAdmin(by: CurrentAdmin, input: z.output<typeof adminUpdateSchema>) {
  if (input.adminId === by.id && (!input.isActive || input.role !== by.role)) {
    throw new SettingsError("You can't change your own role or deactivate yourself.");
  }
  const db = getDb();
  if (input.role !== "SUPER_ADMIN" || !input.isActive) {
    // Never remove the last active super admin.
    const supers = await db.select({ id: admins.id }).from(admins).where(eq(admins.role, "SUPER_ADMIN"));
    const target = await db.select({ role: admins.role, isActive: admins.isActive }).from(admins).where(eq(admins.id, input.adminId));
    if (target[0]?.role === "SUPER_ADMIN" && target[0].isActive && supers.length <= 1) {
      throw new SettingsError("At least one active super admin is required.");
    }
  }
  await db.update(admins).set({ role: input.role, isActive: input.isActive }).where(eq(admins.id, input.adminId));
  if (!input.isActive) await revokeAllSessions("admin", input.adminId);
  await recordAudit({ actor: actor(by), action: "admin.updated", targetType: "admin", targetId: input.adminId, metadata: { role: input.role, isActive: input.isActive } });
}

// --- Loan products --------------------------------------------------------------

export function listProducts() {
  return getDb().select().from(loanProducts).orderBy(asc(loanProducts.sortOrder), asc(loanProducts.name));
}

export async function getProduct(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await getDb().select().from(loanProducts).where(eq(loanProducts.id, id));
  return row ?? null;
}

export async function saveProduct(by: CurrentAdmin, input: z.output<typeof productSchema>) {
  const { id, ...values } = input;
  try {
    if (id) {
      await getDb().update(loanProducts).set(values).where(eq(loanProducts.id, id));
      await recordAudit({ actor: actor(by), action: "product.updated", targetType: "loan_product", targetId: id });
      return id;
    }
    const [row] = await getDb().insert(loanProducts).values(values).returning({ id: loanProducts.id });
    await recordAudit({ actor: actor(by), action: "product.created", targetType: "loan_product", targetId: row?.id });
    return row?.id;
  } catch (err) {
    if (isUniqueViolation(err)) throw new SettingsError("A product with that slug already exists.");
    throw err;
  }
}

// --- Document types -------------------------------------------------------------

export function listDocumentTypes() {
  return getDb().select().from(documentTypes).orderBy(asc(documentTypes.sortOrder));
}

export async function saveDocumentType(by: CurrentAdmin, input: z.output<typeof documentTypeSchema>) {
  await getDb()
    .insert(documentTypes)
    .values(input)
    .onConflictDoUpdate({ target: documentTypes.key, set: { label: input.label, description: input.description, isActive: input.isActive, sortOrder: input.sortOrder } });
  await recordAudit({ actor: actor(by), action: "document_type.updated", targetType: "document_type", targetId: input.key, metadata: { isActive: input.isActive } });
}

// --- Audit log ----------------------------------------------------------------------

export const AUDIT_PAGE_SIZE = 50;

export async function listAuditLogs({ action, page = 1 }: { action?: string; page?: number }) {
  const where: SQL | undefined = action ? eq(auditLogs.action, action) : undefined;
  const db = getDb();
  const [totalRow] = await db.select({ n: count() }).from(auditLogs).where(where);
  const total = totalRow?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      actorType: auditLogs.actorType,
      actorName: admins.name,
      applicationId: auditLogs.applicationId,
      reference: applications.reference,
      targetType: auditLogs.targetType,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(admins, eq(admins.id, auditLogs.actorAdminId))
    .leftJoin(applications, eq(applications.id, auditLogs.applicationId))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(AUDIT_PAGE_SIZE)
    .offset((current - 1) * AUDIT_PAGE_SIZE);
  return { rows, total, page: current, pages };
}

export async function listAuditActions(): Promise<string[]> {
  const rows = await getDb().selectDistinct({ action: auditLogs.action }).from(auditLogs).orderBy(asc(auditLogs.action));
  return rows.map((r) => r.action);
}
