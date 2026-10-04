import { NextResponse } from "next/server";
import { and, eq, isNull, lt, or, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { accountDetails, adminSessions, adminTokens, applicantSessions, applicantTokens, documents } from "@/db/schema";
import { purgeOldRateLimits } from "@/lib/security/rate-limit";
import { recordAudit, SYSTEM_ACTOR } from "@/lib/audit";
import { deleteAsset } from "@/lib/cloudinary/server";
import { cronSecret } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { safeEqual } from "@/lib/security/crypto";
import { logger } from "@/lib/security/logger";

/**
 * Daily housekeeping (Vercel Cron, see vercel.json):
 *  - delete abandoned pre-submission uploads (> 24h)
 *  - delete expired reset/invite tokens, sessions and rate-limit counters
 *  - purge encrypted account details past their retention date
 */
export async function GET(request: Request) {
  const secret = cronSecret();
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return jsonError(401, "Unauthorized");

  const db = getDb();
  const dayAgo = new Date(Date.now() - 86_400_000);
  const summary = { orphanedUploads: 0, sessions: 0, accountDetailsPurged: 0 };

  try {
    const orphans = await db
      .select({ id: documents.id, publicId: documents.cloudinaryPublicId })
      .from(documents)
      .where(and(eq(documents.status, "PENDING"), isNull(documents.applicationId), lt(documents.createdAt, dayAgo)))
      .limit(500);
    for (const doc of orphans) {
      await deleteAsset(doc.publicId).catch((err) => logger.warn("Orphan delete failed", { err }));
      await db.update(documents).set({ status: "DELETED", draftTokenHash: null }).where(eq(documents.id, doc.id));
    }
    summary.orphanedUploads = orphans.length;

    await purgeOldRateLimits();
    await db.delete(adminTokens).where(lt(adminTokens.expiresAt, dayAgo));
    await db.delete(applicantTokens).where(lt(applicantTokens.expiresAt, dayAgo));
    const now = new Date();
    const deadAdmin = await db.delete(adminSessions).where(or(lt(adminSessions.expiresAt, now), isNotNull(adminSessions.revokedAt))).returning({ id: adminSessions.id });
    const deadApplicant = await db
      .delete(applicantSessions)
      .where(or(lt(applicantSessions.expiresAt, now), isNotNull(applicantSessions.revokedAt)))
      .returning({ id: applicantSessions.id });
    summary.sessions = deadAdmin.length + deadApplicant.length;

    // Retention: replace the encrypted payload; keep the masked hint for the record.
    const purged = await db
      .update(accountDetails)
      .set({ encryptedPayload: "purged", purgedAt: now })
      .where(and(lt(accountDetails.purgeAfter, now), isNull(accountDetails.purgedAt)))
      .returning({ id: accountDetails.id, applicationId: accountDetails.applicationId });
    for (const p of purged) {
      await recordAudit({ actor: SYSTEM_ACTOR, action: "account_details.purged", applicationId: p.applicationId, targetType: "account_details", targetId: p.id });
    }
    summary.accountDetailsPurged = purged.length;

    logger.info("Cleanup complete", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    logger.error("Cleanup failed", { err });
    return jsonError(500, "Cleanup failed");
  }
}
