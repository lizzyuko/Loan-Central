import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  accountDetails,
  applications,
  communications,
  documents,
  documentTypes,
  informationRequests,
  loanProducts,
  loanRequests,
} from "@/db/schema";
import { MASK_SOURCE_PRIORITY, maskIdentifier, type BankFieldKey } from "@/config/banking";
import { ACCOUNT_DETAILS_RETENTION_DAYS } from "@/config/site";
import { recordAudit, recordEvent } from "@/lib/audit";
import { assertTransition } from "@/lib/application/status";
import type { CurrentApplicant } from "@/lib/auth/applicant";
import { CURRENT_KEY_VERSION, encrypt } from "@/lib/security/crypto";
import type { AccountDetailsParsed } from "@/lib/validation/account";

/** All portal reads are scoped by applicant id: ownership is never optional. */

export async function listApplicantApplications(applicantId: string) {
  return getDb()
    .select({
      id: applications.id,
      reference: applications.reference,
      status: applications.status,
      submittedAt: applications.submittedAt,
      amount: loanRequests.amount,
      currency: loanRequests.currency,
      productName: loanProducts.name,
    })
    .from(applications)
    .innerJoin(loanRequests, eq(loanRequests.applicationId, applications.id))
    .leftJoin(loanProducts, eq(loanProducts.id, applications.loanProductId))
    .where(eq(applications.applicantId, applicantId))
    .orderBy(desc(applications.submittedAt));
}

export async function getPortalApplication(applicantId: string, applicationId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(applicationId)) return null;
  const db = getDb();
  const [app] = await db
    .select({
      id: applications.id,
      reference: applications.reference,
      status: applications.status,
      submittedAt: applications.submittedAt,
      amount: loanRequests.amount,
      currency: loanRequests.currency,
      termMonths: loanRequests.termMonths,
      purpose: loanRequests.purpose,
      productName: loanProducts.name,
    })
    .from(applications)
    .innerJoin(loanRequests, eq(loanRequests.applicationId, applications.id))
    .leftJoin(loanProducts, eq(loanProducts.id, applications.loanProductId))
    .where(and(eq(applications.id, applicationId), eq(applications.applicantId, applicantId)))
    .limit(1);
  if (!app) return null;

  const [openRequest, messages, docs, types, account] = await Promise.all([
    db
      .select({ id: informationRequests.id, message: informationRequests.message, requestedItems: informationRequests.requestedItems, createdAt: informationRequests.createdAt })
      .from(informationRequests)
      .where(and(eq(informationRequests.applicationId, app.id), eq(informationRequests.status, "OPEN")))
      .orderBy(desc(informationRequests.createdAt))
      .limit(1),
    // Only applicant-visible communications; never internal notes or admin notifications.
    db
      .select({ id: communications.id, subject: communications.subject, body: communications.body, createdAt: communications.createdAt })
      .from(communications)
      .where(and(eq(communications.applicationId, app.id), eq(communications.visibleToApplicant, true)))
      .orderBy(desc(communications.createdAt)),
    db
      .select({ id: documents.id, documentType: documents.documentType, filename: documents.originalFilename, bytes: documents.bytes, informationRequestId: documents.informationRequestId })
      .from(documents)
      .where(and(eq(documents.applicationId, app.id), eq(documents.status, "ATTACHED")))
      .orderBy(asc(documents.createdAt)),
    db.select({ key: documentTypes.key, label: documentTypes.label, description: documentTypes.description }).from(documentTypes),
    db
      .select({ bankName: accountDetails.bankName, maskedIdentifier: accountDetails.maskedIdentifier, submittedAt: accountDetails.submittedAt })
      .from(accountDetails)
      .where(eq(accountDetails.applicationId, app.id))
      .limit(1),
  ]);

  return { ...app, openRequest: openRequest[0] ?? null, messages, documents: docs, documentTypes: types, accountSummary: account[0] ?? null };
}

export type PortalApplication = NonNullable<Awaited<ReturnType<typeof getPortalApplication>>>;

export class PortalError extends Error {}

/** Applicant responds to an open information request; returns it to review. */
export async function respondToInformationRequest(applicant: CurrentApplicant, applicationId: string, requestId: string, responseText: string | undefined) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [app] = await tx
      .select({ id: applications.id, status: applications.status })
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.applicantId, applicant.id)))
      .limit(1);
    if (!app) throw new PortalError("Application not found.");

    const [req] = await tx
      .select({ id: informationRequests.id, requestedItems: informationRequests.requestedItems })
      .from(informationRequests)
      .where(and(eq(informationRequests.id, requestId), eq(informationRequests.applicationId, app.id), eq(informationRequests.status, "OPEN")))
      .limit(1);
    if (!req) throw new PortalError("This request has already been answered.");

    // Requested documents must be uploaded before responding.
    const uploaded = await tx
      .select({ documentType: documents.documentType })
      .from(documents)
      .where(and(eq(documents.informationRequestId, req.id), eq(documents.status, "ATTACHED")));
    const missing = req.requestedItems.filter((k) => k !== "other" && !uploaded.some((d) => d.documentType === k));
    if (missing.length > 0) throw new PortalError("Please upload each requested document before sending your response.");
    if (req.requestedItems.length === 0 && !responseText) throw new PortalError("Please add a response.");

    await tx
      .update(informationRequests)
      .set({ status: "FULFILLED", responseText: responseText ?? null, fulfilledAt: new Date() })
      .where(eq(informationRequests.id, req.id));

    if (app.status === "MORE_INFORMATION_REQUIRED") {
      assertTransition(app.status, "UNDER_REVIEW");
      await tx
        .update(applications)
        .set({ status: "UNDER_REVIEW", statusChangedAt: new Date() })
        .where(and(eq(applications.id, app.id), eq(applications.status, "MORE_INFORMATION_REQUIRED")));
    }

    const actor = { type: "APPLICANT" as const, applicantId: applicant.id };
    await recordEvent({ applicationId: app.id, type: "info.provided", summary: "Applicant submitted requested information", actor, metadata: { documents: uploaded.length } }, tx);
    if (app.status === "MORE_INFORMATION_REQUIRED") {
      await recordEvent({ applicationId: app.id, type: "status.changed", summary: "Status changed to Under review", actor, metadata: { from: app.status, to: "UNDER_REVIEW" } }, tx);
    }
    await recordAudit({ actor, action: "application.info_provided", applicationId: app.id }, tx);
  });
}

/** Stores encrypted account details and moves the application to final review. */
export async function submitAccountDetails(applicant: CurrentApplicant, input: AccountDetailsParsed, ipHash: string | null) {
  const source = MASK_SOURCE_PRIORITY.find((k) => input.identifiers[k]);
  if (!source) throw new PortalError("An account number or IBAN is required.");
  const masked = maskIdentifier(input.identifiers[source]!);
  const maskType = source === "iban" ? "IBAN" : "Account number";
  const payload = encrypt(JSON.stringify(input.identifiers satisfies Partial<Record<BankFieldKey, string>>));
  const purgeAfter = new Date(Date.now() + ACCOUNT_DETAILS_RETENTION_DAYS * 86_400_000);

  await getDb().transaction(async (tx) => {
    const [app] = await tx
      .select({ id: applications.id, status: applications.status })
      .from(applications)
      .where(and(eq(applications.id, input.applicationId), eq(applications.applicantId, applicant.id)))
      .limit(1);
    if (!app) throw new PortalError("Application not found.");
    if (app.status !== "ACCOUNT_DETAILS_REQUESTED") throw new PortalError("Account details aren't being requested for this application.");

    const values = {
      accountHolderName: input.accountHolderName,
      bankName: input.bankName,
      country: input.country,
      currency: input.currency,
      maskedIdentifier: masked,
      maskedIdentifierType: maskType,
      encryptedPayload: payload,
      keyVersion: CURRENT_KEY_VERSION,
      submittedAt: new Date(),
      purgeAfter,
      purgedAt: null,
    };
    await tx
      .insert(accountDetails)
      .values({ applicationId: app.id, ...values })
      .onConflictDoUpdate({ target: accountDetails.applicationId, set: { ...values, updatedAt: new Date() } });

    assertTransition(app.status, "FINAL_REVIEW");
    const moved = await tx
      .update(applications)
      .set({ status: "FINAL_REVIEW", statusChangedAt: new Date() })
      .where(and(eq(applications.id, app.id), eq(applications.status, "ACCOUNT_DETAILS_REQUESTED")))
      .returning({ id: applications.id });
    if (moved.length === 0) throw new PortalError("This application was updated. Please refresh and try again.");

    const actor = { type: "APPLICANT" as const, applicantId: applicant.id };
    await recordEvent({ applicationId: app.id, type: "account.submitted", summary: "Applicant provided account details", actor }, tx);
    await recordEvent({ applicationId: app.id, type: "status.changed", summary: "Status changed to Final review", actor, metadata: { from: app.status, to: "FINAL_REVIEW" } }, tx);
    // No identifier values in audit metadata, only which scheme was used.
    await recordAudit({ actor, action: "account_details.submitted", applicationId: app.id, metadata: { scheme: input.scheme, country: input.country }, ipHash }, tx);
  });
}
