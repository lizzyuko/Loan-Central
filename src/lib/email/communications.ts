import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { communications } from "@/db/schema";
import type { CommunicationType } from "@/db/schema/enums";
import { logger } from "@/lib/security/logger";
import { sendEmail, type SendResult } from "./client";
import type { EmailContent } from "./layout";

interface SendAndRecordInput {
  applicationId: string | null;
  type: CommunicationType;
  to: string;
  email: EmailContent;
  senderAdminId?: string | null;
  /** Plain message shown to the applicant in the portal (no sensitive data). */
  portalBody?: string;
  visibleToApplicant?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Records the communication (QUEUED), sends it, then stores the delivery
 * result. Email failures never throw, so business actions are never rolled
 * back because a provider was unavailable.
 */
export async function sendAndRecord(input: SendAndRecordInput): Promise<SendResult & { communicationId: string | null }> {
  const db = getDb();
  let communicationId: string | null = null;
  try {
    const [row] = await db
      .insert(communications)
      .values({
        applicationId: input.applicationId,
        type: input.type,
        senderAdminId: input.senderAdminId ?? null,
        recipientEmail: input.to,
        subject: input.email.subject,
        body: input.portalBody ?? null,
        visibleToApplicant: input.visibleToApplicant ?? false,
        metadata: input.metadata,
        deliveryStatus: "QUEUED",
      })
      .returning({ id: communications.id });
    communicationId = row?.id ?? null;
  } catch (err) {
    logger.error("Failed to record communication", { type: input.type, err });
  }

  const result = await sendEmail(input.to, input.email, communicationId ? `comm-${communicationId}` : undefined);

  if (communicationId) {
    try {
      await db
        .update(communications)
        .set({
          deliveryStatus: result.status,
          provider: result.provider ?? null,
          providerMessageId: result.providerMessageId ?? null,
          errorCode: result.errorCode ?? null,
        })
        .where(eq(communications.id, communicationId));
    } catch (err) {
      logger.error("Failed to update communication status", { err });
    }
  }
  return { ...result, communicationId };
}
