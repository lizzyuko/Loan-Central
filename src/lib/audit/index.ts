import "server-only";
import { applicationEvents, auditLogs } from "@/db/schema";
import type { ActorType } from "@/db/schema/enums";
import type { DbOrTx } from "@/db";
import { getDb } from "@/db";
import { logger } from "@/lib/security/logger";

/**
 * Audit actions. Keep values stable; they are queried in the audit log UI.
 */
export type AuditAction =
  | "admin.login"
  | "admin.logout"
  | "admin.login_failed"
  | "admin.created"
  | "admin.updated"
  | "applicant.login"
  | "application.submitted"
  | "application.viewed"
  | "application.status_changed"
  | "application.info_requested"
  | "application.info_provided"
  | "application.eligibility_recorded"
  | "application.account_details_requested"
  | "note.created"
  | "document.accessed"
  | "document.uploaded"
  | "message.sent"
  | "account_details.submitted"
  | "account_details.viewed_masked"
  | "account_details.revealed"
  | "account_details.purged"
  | "product.created"
  | "product.updated"
  | "document_type.updated";

export interface Actor {
  type: ActorType;
  adminId?: string | null;
  applicantId?: string | null;
}

export const SYSTEM_ACTOR: Actor = { type: "SYSTEM" };

interface AuditInput {
  actor: Actor;
  action: AuditAction;
  applicationId?: string | null;
  targetType?: string;
  targetId?: string;
  /** Never put raw sensitive values here. */
  metadata?: Record<string, unknown>;
  ipHash?: string | null;
}

export async function recordAudit(input: AuditInput, db: DbOrTx = getDb()): Promise<void> {
  await db.insert(auditLogs).values({
    actorType: input.actor.type,
    actorAdminId: input.actor.adminId ?? null,
    actorApplicantId: input.actor.applicantId ?? null,
    action: input.action,
    applicationId: input.applicationId ?? null,
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: input.metadata,
    ipHash: input.ipHash ?? null,
  });
}

/** Audit that must not break the user flow if it fails (e.g. read events). */
export async function recordAuditSafe(input: AuditInput): Promise<void> {
  try {
    await recordAudit(input);
  } catch (err) {
    logger.error("Failed to write audit log", { action: input.action, err });
  }
}

interface EventInput {
  applicationId: string;
  type: string;
  summary: string;
  actor: Actor;
  metadata?: Record<string, unknown>;
}

/** Timeline entry on an application (visible to admins). */
export async function recordEvent(input: EventInput, db: DbOrTx = getDb()): Promise<void> {
  await db.insert(applicationEvents).values({
    applicationId: input.applicationId,
    type: input.type,
    summary: input.summary,
    actorType: input.actor.type,
    actorAdminId: input.actor.adminId ?? null,
    metadata: input.metadata,
  });
}

export async function recordEventSafe(input: EventInput): Promise<void> {
  try {
    await recordEvent(input);
  } catch (err) {
    logger.error("Failed to write application event", { type: input.type, err });
  }
}
