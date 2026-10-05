import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, type Transaction } from "@/db";
import { accountDetails, adminNotes, applicants, applications, documentTypes, informationRequests } from "@/db/schema";
import type { ApplicationStatus, CommunicationType } from "@/db/schema/enums";
import { APPLICANT_STATUS_COPY, assertTransition, InvalidTransitionError, STATUS_LABELS, WORKFLOW_ONLY_TARGETS } from "@/lib/application/status";
import { portalUrl } from "@/lib/application/notifications";
import { recordAudit, recordEvent, type Actor } from "@/lib/audit";
import type { CurrentAdmin } from "@/lib/auth/admin";
import { sendAndRecord } from "@/lib/email/communications";
import type { EmailContent } from "@/lib/email/layout";
import {
  accountDetailsRequestEmail,
  eligibilityEmail,
  generalMessageEmail,
  moreInformationEmail,
  statusUpdateEmail,
  underReviewEmail,
} from "@/lib/email/templates";
import { decrypt } from "@/lib/security/crypto";

export class ReviewError extends Error {}

export type ReviewResult = { ok: true; message: string; emailStatus?: string } | { ok: false; error: string };

interface AppContext {
  id: string;
  reference: string;
  status: ApplicationStatus;
  email: string;
  firstName: string;
}

const adminActor = (admin: CurrentAdmin): Actor => ({ type: "ADMIN", adminId: admin.id });

async function loadContext(applicationId: string): Promise<AppContext> {
  const [row] = await getDb()
    .select({ id: applications.id, reference: applications.reference, status: applications.status, email: applicants.email, firstName: applicants.firstName })
    .from(applications)
    .innerJoin(applicants, eq(applicants.id, applications.applicantId))
    .where(eq(applications.id, applicationId))
    .limit(1);
  if (!row) throw new ReviewError("Application not found.");
  return row;
}

/**
 * Compare-and-set status change: fails if another reviewer changed the status
 * in the meantime, so two admins can't make conflicting decisions.
 */
async function transition(tx: Transaction, app: AppContext, to: ApplicationStatus, admin: CurrentAdmin, extra?: Record<string, unknown>) {
  assertTransition(app.status, to);
  const updated = await tx
    .update(applications)
    .set({ status: to, statusChangedAt: new Date() })
    .where(and(eq(applications.id, app.id), eq(applications.status, app.status)))
    .returning({ id: applications.id });
  if (updated.length === 0) throw new ReviewError("This application was updated by someone else. Refresh and try again.");

  const actor = adminActor(admin);
  await recordEvent(
    { applicationId: app.id, type: "status.changed", summary: `Status changed to ${STATUS_LABELS[to]}`, actor, metadata: { from: app.status, to, ...extra } },
    tx,
  );
  await recordAudit({ actor, action: "application.status_changed", applicationId: app.id, metadata: { from: app.status, to } }, tx);
}

async function notify(app: AppContext, admin: CurrentAdmin, type: CommunicationType, email: EmailContent, portalBody: string) {
  const res = await sendAndRecord({
    applicationId: app.id,
    type,
    to: app.email,
    email,
    senderAdminId: admin.id,
    portalBody,
    visibleToApplicant: true,
  });
  await recordEvent({
    applicationId: app.id,
    type: "email.sent",
    summary: res.status === "SENT" ? `Email sent: ${email.subject}` : `Email could not be sent: ${email.subject}`,
    actor: adminActor(admin),
    metadata: { communicationType: type, deliveryStatus: res.status },
  }).catch(() => undefined);
  return res.status;
}

function wrap(fn: () => Promise<ReviewResult>): Promise<ReviewResult> {
  return fn().catch((err: unknown) => {
    if (err instanceof ReviewError || err instanceof InvalidTransitionError) return { ok: false, error: err.message };
    throw err;
  });
}

// --- Actions --------------------------------------------------------------------

/** Generic status changes (workflow decisions use their dedicated actions). */
export function changeStatus(admin: CurrentAdmin, applicationId: string, to: ApplicationStatus, sendEmail: boolean) {
  return wrap(async () => {
    if (WORKFLOW_ONLY_TARGETS.includes(to)) throw new ReviewError("Use the dedicated action for this decision.");
    const app = await loadContext(applicationId);
    await getDb().transaction((tx) => transition(tx, app, to, admin));

    let emailStatus: string | undefined;
    if (sendEmail) {
      const url = portalUrl();
      const email =
        to === "UNDER_REVIEW"
          ? underReviewEmail({ firstName: app.firstName, reference: app.reference, portalUrl: url })
          : statusUpdateEmail({ firstName: app.firstName, reference: app.reference, statusText: APPLICANT_STATUS_COPY[to], portalUrl: url });
      emailStatus = await notify(app, admin, "STATUS_UPDATE", email, APPLICANT_STATUS_COPY[to]);
    }
    return { ok: true, message: `Status changed to ${STATUS_LABELS[to]}.`, emailStatus };
  });
}

export function requestInformation(admin: CurrentAdmin, applicationId: string, items: string[], message: string) {
  return wrap(async () => {
    const app = await loadContext(applicationId);
    const types = await getDb().select({ key: documentTypes.key, label: documentTypes.label }).from(documentTypes);
    const labels = items.map((k) => types.find((t) => t.key === k)?.label).filter((l): l is string => Boolean(l));

    await getDb().transaction(async (tx) => {
      // Close any earlier open request; the newest one supersedes it.
      await tx
        .update(informationRequests)
        .set({ status: "CANCELLED" })
        .where(and(eq(informationRequests.applicationId, app.id), eq(informationRequests.status, "OPEN")));
      await tx.insert(informationRequests).values({ applicationId: app.id, requestedByAdminId: admin.id, requestedItems: items, message });
      await transition(tx, app, "MORE_INFORMATION_REQUIRED", admin);
      await recordAudit({ actor: adminActor(admin), action: "application.info_requested", applicationId: app.id, metadata: { items } }, tx);
    });

    const emailStatus = await notify(
      app,
      admin,
      "INFORMATION_REQUEST",
      moreInformationEmail({ firstName: app.firstName, reference: app.reference, message, items: labels, portalUrl: portalUrl() }),
      message,
    );
    return { ok: true, message: "Information requested.", emailStatus };
  });
}

export function recordEligibility(admin: CurrentAdmin, applicationId: string, eligible: boolean, message: string | undefined, sendEmail: boolean) {
  return wrap(async () => {
    const app = await loadContext(applicationId);
    const to: ApplicationStatus = eligible ? "ELIGIBLE" : "NOT_ELIGIBLE";
    await getDb().transaction(async (tx) => {
      await transition(tx, app, to, admin, { decision: eligible ? "eligible" : "not_eligible" });
      await recordAudit({ actor: adminActor(admin), action: "application.eligibility_recorded", applicationId: app.id, metadata: { eligible } }, tx);
    });

    // Not-eligible decisions are always communicated; eligible is optional.
    let emailStatus: string | undefined;
    if (sendEmail || !eligible) {
      emailStatus = await notify(
        app,
        admin,
        "ELIGIBILITY_DECISION",
        eligibilityEmail({ firstName: app.firstName, reference: app.reference, eligible, message, portalUrl: portalUrl() }),
        message ?? APPLICANT_STATUS_COPY[to],
      );
    }
    return { ok: true, message: eligible ? "Marked as potentially eligible." : "Marked as not eligible.", emailStatus };
  });
}

export function requestAccountDetails(admin: CurrentAdmin, applicationId: string, message: string | undefined) {
  return wrap(async () => {
    const app = await loadContext(applicationId);
    await getDb().transaction(async (tx) => {
      await transition(tx, app, "ACCOUNT_DETAILS_REQUESTED", admin);
      await recordAudit({ actor: adminActor(admin), action: "application.account_details_requested", applicationId: app.id }, tx);
    });
    const emailStatus = await notify(
      app,
      admin,
      "ACCOUNT_DETAILS_REQUEST",
      accountDetailsRequestEmail({ firstName: app.firstName, reference: app.reference, message, portalUrl: `${portalUrl()}/applications/${app.id}` }),
      message ?? APPLICANT_STATUS_COPY.ACCOUNT_DETAILS_REQUESTED,
    );
    return { ok: true, message: "Account details requested.", emailStatus };
  });
}

export function sendCustomMessage(admin: CurrentAdmin, applicationId: string, subject: string, message: string) {
  return wrap(async () => {
    const app = await loadContext(applicationId);
    const emailStatus = await notify(
      app,
      admin,
      "CUSTOM_MESSAGE",
      generalMessageEmail({ firstName: app.firstName, reference: app.reference, subject, message, portalUrl: portalUrl() }),
      message,
    );
    await recordAudit({ actor: adminActor(admin), action: "message.sent", applicationId: app.id, metadata: { subject } });
    return { ok: true, message: "Message sent.", emailStatus };
  });
}

export function addNote(admin: CurrentAdmin, applicationId: string, body: string) {
  return wrap(async () => {
    const app = await loadContext(applicationId);
    await getDb().transaction(async (tx) => {
      const [note] = await tx.insert(adminNotes).values({ applicationId: app.id, adminId: admin.id, body }).returning({ id: adminNotes.id });
      await recordEvent({ applicationId: app.id, type: "note.created", summary: "Private note added", actor: adminActor(admin) }, tx);
      await recordAudit({ actor: adminActor(admin), action: "note.created", applicationId: app.id, targetType: "note", targetId: note?.id }, tx);
    });
    return { ok: true, message: "Note added." };
  });
}

/** First-view tracking + audit of every view. */
export async function recordApplicationViewed(admin: CurrentAdmin, applicationId: string, ipHash: string | null) {
  const db = getDb();
  const firstView = await db
    .update(applications)
    .set({ firstViewedAt: new Date() })
    .where(and(eq(applications.id, applicationId), isNull(applications.firstViewedAt)))
    .returning({ id: applications.id });
  if (firstView.length > 0) {
    await recordEvent({ applicationId, type: "application.viewed", summary: "Admin opened application", actor: adminActor(admin) });
  }
  await recordAudit({ actor: adminActor(admin), action: "application.viewed", applicationId, ipHash });
}

// --- Sensitive account details -------------------------------------------------------

export type RevealedAccount = Record<string, string>;

/** Decrypts the national ID number. Caller MUST have checked `identity.reveal`. */
export async function revealNationalId(admin: CurrentAdmin, applicationId: string, ipHash: string | null): Promise<string | null> {
  const [row] = await getDb()
    .select({ enc: applications.nationalIdEncrypted, type: applications.nationalIdType })
    .from(applications)
    .where(eq(applications.id, applicationId))
    .limit(1);
  if (!row?.enc) return null;
  await recordAudit({ actor: adminActor(admin), action: "identity.revealed", applicationId, targetType: "national_id", metadata: { type: row.type }, ipHash });
  return decrypt(row.enc);
}

/** Decrypts account identifiers. Caller MUST have checked `account_details.reveal`. */
export async function revealAccountDetails(admin: CurrentAdmin, applicationId: string, ipHash: string | null): Promise<RevealedAccount | null> {
  const [row] = await getDb()
    .select({ id: accountDetails.id, payload: accountDetails.encryptedPayload, purgedAt: accountDetails.purgedAt })
    .from(accountDetails)
    .where(eq(accountDetails.applicationId, applicationId))
    .limit(1);
  if (!row || row.purgedAt) return null;
  await recordAudit({
    actor: adminActor(admin),
    action: "account_details.revealed",
    applicationId,
    targetType: "account_details",
    targetId: row.id,
    ipHash,
  });
  return JSON.parse(decrypt(row.payload)) as RevealedAccount;
}
