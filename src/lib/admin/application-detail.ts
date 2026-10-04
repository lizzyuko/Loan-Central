import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  accountDetails,
  addresses,
  adminNotes,
  admins,
  applicants,
  applicationEvents,
  applications,
  communications,
  consents,
  documents,
  documentTypes,
  eligibilityRules,
  employmentProfiles,
  financialProfiles,
  informationRequests,
  loanProducts,
  loanRequests,
} from "@/db/schema";
import { DEFAULT_REQUIRED_DOCUMENTS } from "@/config/documents";
import { evaluateIndicators, type Indicator } from "@/lib/application/eligibility";

/**
 * Everything an admin needs to review one application. Deliberately excludes
 * document URLs (served via /api/documents/[id]) and encrypted account data
 * (only the masked hint is returned).
 */
export async function getApplicationDetail(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = getDb();

  const [row] = await db
    .select({
      application: applications,
      applicant: applicants,
      loan: loanRequests,
      address: addresses,
      employment: employmentProfiles,
      financial: financialProfiles,
      product: { id: loanProducts.id, name: loanProducts.name, requiredDocumentTypes: loanProducts.requiredDocumentTypes, supportedCountries: loanProducts.supportedCountries },
    })
    .from(applications)
    .innerJoin(applicants, eq(applicants.id, applications.applicantId))
    .innerJoin(loanRequests, eq(loanRequests.applicationId, applications.id))
    .innerJoin(addresses, eq(addresses.applicationId, applications.id))
    .innerJoin(employmentProfiles, eq(employmentProfiles.applicationId, applications.id))
    .innerJoin(financialProfiles, eq(financialProfiles.applicationId, applications.id))
    .leftJoin(loanProducts, eq(loanProducts.id, applications.loanProductId))
    .where(eq(applications.id, id))
    .limit(1);
  if (!row) return null;

  const [docs, docTypes, events, notes, comms, requests, account, consentRows, rules] = await Promise.all([
    db
      .select({
        id: documents.id,
        documentType: documents.documentType,
        filename: documents.originalFilename,
        mimeType: documents.mimeType,
        bytes: documents.bytes,
        uploadedBy: documents.uploadedBy,
        informationRequestId: documents.informationRequestId,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(and(eq(documents.applicationId, id), eq(documents.status, "ATTACHED")))
      .orderBy(asc(documents.createdAt)),
    db.select({ key: documentTypes.key, label: documentTypes.label }).from(documentTypes),
    db
      .select({
        id: applicationEvents.id,
        type: applicationEvents.type,
        summary: applicationEvents.summary,
        actorType: applicationEvents.actorType,
        actorName: admins.name,
        metadata: applicationEvents.metadata,
        createdAt: applicationEvents.createdAt,
      })
      .from(applicationEvents)
      .leftJoin(admins, eq(admins.id, applicationEvents.actorAdminId))
      .where(eq(applicationEvents.applicationId, id))
      .orderBy(desc(applicationEvents.createdAt)),
    db
      .select({ id: adminNotes.id, body: adminNotes.body, authorName: admins.name, createdAt: adminNotes.createdAt })
      .from(adminNotes)
      .leftJoin(admins, eq(admins.id, adminNotes.adminId))
      .where(eq(adminNotes.applicationId, id))
      .orderBy(desc(adminNotes.createdAt)),
    db
      .select({
        id: communications.id,
        type: communications.type,
        subject: communications.subject,
        body: communications.body,
        recipientEmail: communications.recipientEmail,
        deliveryStatus: communications.deliveryStatus,
        senderName: admins.name,
        createdAt: communications.createdAt,
      })
      .from(communications)
      .leftJoin(admins, eq(admins.id, communications.senderAdminId))
      .where(and(eq(communications.applicationId, id), ne(communications.type, "ADMIN_NOTIFICATION")))
      .orderBy(desc(communications.createdAt)),
    db.select().from(informationRequests).where(eq(informationRequests.applicationId, id)).orderBy(desc(informationRequests.createdAt)),
    db
      .select({
        id: accountDetails.id,
        accountHolderName: accountDetails.accountHolderName,
        bankName: accountDetails.bankName,
        country: accountDetails.country,
        currency: accountDetails.currency,
        maskedIdentifier: accountDetails.maskedIdentifier,
        maskedIdentifierType: accountDetails.maskedIdentifierType,
        submittedAt: accountDetails.submittedAt,
        purgedAt: accountDetails.purgedAt,
      })
      .from(accountDetails)
      .where(eq(accountDetails.applicationId, id))
      .limit(1),
    db.select({ consentType: consents.consentType, version: consents.version, acceptedAt: consents.acceptedAt }).from(consents).where(eq(consents.applicationId, id)),
    db
      .select({ ruleType: eligibilityRules.ruleType, config: eligibilityRules.config, description: eligibilityRules.description })
      .from(eligibilityRules)
      .where(
        and(
          eq(eligibilityRules.isActive, true),
          row.product ? or(isNull(eligibilityRules.loanProductId), eq(eligibilityRules.loanProductId, row.product.id)) : isNull(eligibilityRules.loanProductId),
        ),
      ),
  ]);

  const requiredDocuments = row.product?.requiredDocumentTypes.length ? row.product.requiredDocumentTypes : DEFAULT_REQUIRED_DOCUMENTS;
  const indicators: Indicator[] = evaluateIndicators(rules, {
    dateOfBirth: row.applicant.dateOfBirth,
    country: row.application.country,
    employmentStatus: row.employment.employmentStatus,
    monthlyIncome: row.employment.monthlyIncome,
    incomeCurrency: row.employment.incomeCurrency,
    monthlyDebt: row.financial.monthlyDebtPayments,
    debtCurrency: row.financial.currency,
    productCountries: row.product?.supportedCountries ?? [],
    requiredDocuments,
    uploadedDocumentTypes: docs.map((d) => d.documentType),
  });

  return {
    ...row,
    documents: docs,
    documentLabels: Object.fromEntries(docTypes.map((t) => [t.key, t.label])) as Record<string, string>,
    events,
    notes,
    communications: comms,
    informationRequests: requests,
    accountDetails: account[0] ?? null,
    consents: consentRows,
    indicators,
  };
}

export type ApplicationDetail = NonNullable<Awaited<ReturnType<typeof getApplicationDetail>>>;

export async function getAdminDisplayNames(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const rows = await getDb().select({ id: admins.id, name: admins.name }).from(admins).where(inArray(admins.id, ids));
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}
