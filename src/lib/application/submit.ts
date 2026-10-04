import "server-only";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import {
  addresses,
  applicants,
  applications,
  consents,
  documents,
  documentTypes,
  employmentProfiles,
  financialProfiles,
  loanProducts,
  loanRequests,
} from "@/db/schema";
import { CONSENT_VERSIONS } from "@/content/legal";
import { recordAudit, recordEvent } from "@/lib/audit";
import { logger } from "@/lib/security/logger";
import { rateLimit } from "@/lib/security/rate-limit";
import type { RequestContext } from "@/lib/security/request";
import { verifyTurnstile } from "@/lib/turnstile/verify";
import { applicationSubmissionSchema, CONSENT_KEYS, toE164, type ApplicationSubmission } from "@/lib/validation/application";
import { hashPassword, newPasswordSchema, verifyPassword } from "@/lib/auth/password";
import { DEFAULT_REQUIRED_DOCUMENTS } from "@/config/documents";
import { toMonthlyIncome } from "./income";
import { generateReference } from "./reference";
import type { SubmitApplicationResult } from "./submit-types";

const STEP_FOR_SECTION: Record<string, NonNullable<Extract<SubmitApplicationResult, { ok: false }>["step"]>> = {
  loan: "loan",
  personal: "personal",
  address: "address",
  employment: "employment",
  financial: "financial",
  documents: "documents",
  consent: "review",
};

/** A recent application from the same email is treated as an accidental duplicate. */
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

export interface SubmitDeps {
  ctx: RequestContext;
  draftTokenHash: string | null;
}

export interface SubmittedApplication {
  id: string;
  applicantId: string;
  reference: string;
  email: string;
  firstName: string;
  amount: string;
  currency: string;
  country: string;
  productName: string | null;
}

type Outcome =
  | { result: SubmitApplicationResult; created?: undefined }
  | { result: Extract<SubmitApplicationResult, { ok: true }>; created: SubmittedApplication };

function fail(error: string, extra: Partial<Extract<SubmitApplicationResult, { ok: false }>> = {}): Outcome {
  return { result: { ok: false, error, ...extra } };
}

function firstIssueStep(error: z.ZodError) {
  const section = String(error.issues[0]?.path[0] ?? "");
  return STEP_FOR_SECTION[section];
}

/**
 * Validates, de-duplicates and persists an application in one transaction.
 * Pure of request/cookie access so it can be tested; notification side
 * effects are performed by the caller with the returned `created` record.
 */
export async function submitApplication(raw: unknown, deps: SubmitDeps): Promise<Outcome> {
  // 1. Validate everything server-side (never trust the wizard).
  const parsed = applicationSubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    const step = firstIssueStep(parsed.error);
    return fail(parsed.error.issues[0]?.message ?? "Please check your answers and try again.", { step, resetTurnstile: false });
  }
  const input = parsed.data;
  const db = getDb();

  // 2. Idempotency: a retried submission returns the original result.
  const existing = await db
    .select({ reference: applications.reference })
    .from(applications)
    .where(eq(applications.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (existing[0]) {
    return { result: { ok: true, reference: existing[0].reference, email: input.personal.email } } as Outcome;
  }

  // 3. Abuse protection.
  const limit = await rateLimit("applicationSubmitByIp", deps.ctx.ipHash ?? "unknown");
  if (!limit.success) {
    return fail("Too many applications have been submitted from your network. Please try again later.", { resetTurnstile: true });
  }
  const bot = await verifyTurnstile({ token: input.turnstileToken, action: "apply", remoteIp: deps.ctx.ip });
  if (!bot.success) {
    return fail(
      bot.reason === "unavailable"
        ? "We couldn't complete the security check. Please try again in a moment."
        : "The security check expired or failed. Please complete it again.",
      { step: "review", resetTurnstile: true },
    );
  }

  // 4. Accidental duplicate (e.g. submitted from two tabs).
  const [recent] = await db
    .select({ id: applications.id })
    .from(applications)
    .innerJoin(applicants, eq(applicants.id, applications.applicantId))
    .where(and(eq(applicants.email, input.personal.email), gt(applications.createdAt, new Date(Date.now() - DUPLICATE_WINDOW_MS))))
    .limit(1);
  if (recent) {
    return fail("An application was just submitted with this email address. Please check your inbox for the confirmation.", {
      resetTurnstile: true,
    });
  }

  // 5. Product + documents.
  const product = input.loan.productSlug
    ? (
        await db
          .select({ id: loanProducts.id, name: loanProducts.name, requiredDocumentTypes: loanProducts.requiredDocumentTypes })
          .from(loanProducts)
          .where(and(eq(loanProducts.slug, input.loan.productSlug), eq(loanProducts.isActive, true)))
          .limit(1)
      )[0]
    : undefined;
  if (input.loan.productSlug && !product) {
    return fail("The selected loan type is no longer available. Please choose another.", { step: "loan", resetTurnstile: true });
  }

  const docCheck = await checkDocuments(input, product?.requiredDocumentTypes, deps.draftTokenHash);
  if (!docCheck.ok) return fail(docCheck.error, { step: "documents", resetTurnstile: true });

  // 6. Account: create one for new applicants; returning applicants must prove ownership.
  const account = await resolveAccount(input.personal.email, input.password);
  if (!account.ok) return fail(account.error, { step: "review", resetTurnstile: true });

  // 7. Persist atomically. Retry only on (very rare) reference collisions.
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const created = await persist(input, product ?? null, docCheck.documentIds, deps, account.account);
      return { result: { ok: true, reference: created.reference, email: created.email }, created };
    } catch (err) {
      if (isUniqueViolation(err, "applications_reference_idx")) continue;
      if (isUniqueViolation(err, "applications_idempotency_idx")) {
        const [row] = await db
          .select({ reference: applications.reference })
          .from(applications)
          .where(eq(applications.idempotencyKey, input.idempotencyKey));
        if (row) return { result: { ok: true, reference: row.reference, email: input.personal.email } } as Outcome;
      }
      if (err instanceof AccountRaceError) {
        return fail(ACCOUNT_EXISTS, { step: "review", resetTurnstile: true });
      }
      logger.error("Application persistence failed", { err });
      return fail("We couldn't save your application. Please try again.", { resetTurnstile: true });
    }
  }
  return fail("We couldn't save your application. Please try again.", { resetTurnstile: true });
}

const ACCOUNT_EXISTS =
  "An account already exists for this email address. Choose \"Already have an account?\" and enter that account's password, or reset it from the sign-in page.";

class AccountRaceError extends Error {}

type AccountPlan = { kind: "new"; passwordHash: string } | { kind: "existing"; applicantId: string };

/**
 * New email: validate and hash the chosen password. Existing email: the
 * password must match, so nobody can attach applications to (or overwrite
 * the details of) someone else's account.
 */
async function resolveAccount(email: string, password: string): Promise<{ ok: true; account: AccountPlan } | { ok: false; error: string }> {
  const [existing] = await getDb()
    .select({ id: applicants.id, passwordHash: applicants.passwordHash })
    .from(applicants)
    .where(eq(applicants.email, email))
    .limit(1);

  if (!existing) {
    const policy = newPasswordSchema.safeParse(password);
    if (!policy.success) return { ok: false, error: policy.error.issues[0]?.message ?? "Choose a stronger password." };
    return { ok: true, account: { kind: "new", passwordHash: await hashPassword(password) } };
  }
  if (!existing.passwordHash) {
    return {
      ok: false,
      error: "An account already exists for this email address. Use \"Forgot password\" on the sign-in page to set a password, then submit again. Your answers are saved in this browser.",
    };
  }
  if (!(await verifyPassword(password, existing.passwordHash))) return { ok: false, error: ACCOUNT_EXISTS };
  return { ok: true, account: { kind: "existing", applicantId: existing.id } };
}

async function checkDocuments(
  input: ApplicationSubmission,
  productRequired: string[] | undefined,
  draftTokenHash: string | null,
): Promise<{ ok: true; documentIds: string[] } | { ok: false; error: string }> {
  const ids = [...new Set(input.documents.documentIds)];
  const db = getDb();

  let uploaded: { id: string; documentType: string }[] = [];
  if (ids.length > 0) {
    if (!draftTokenHash) return { ok: false, error: "Your uploaded documents have expired. Please upload them again." };
    uploaded = await db
      .select({ id: documents.id, documentType: documents.documentType })
      .from(documents)
      .where(
        and(
          inArray(documents.id, ids),
          eq(documents.draftTokenHash, draftTokenHash),
          eq(documents.status, "PENDING"),
          isNull(documents.applicationId),
        ),
      );
    if (uploaded.length !== ids.length) {
      return { ok: false, error: "Some uploaded documents could not be found. Please upload them again." };
    }
  }

  // Required documents = product config (or defaults), limited to active types.
  const activeTypes = await db.select({ key: documentTypes.key }).from(documentTypes).where(eq(documentTypes.isActive, true));
  const active = new Set(activeTypes.map((t) => t.key));
  const required = (productRequired?.length ? productRequired : DEFAULT_REQUIRED_DOCUMENTS).filter((k) => active.has(k));
  const missing = required.filter((k) => !uploaded.some((d) => d.documentType === k));
  if (missing.length > 0) {
    return { ok: false, error: "Please upload all required documents before submitting." };
  }
  return { ok: true, documentIds: uploaded.map((d) => d.id) };
}

async function persist(
  input: ApplicationSubmission,
  product: { id: string; name: string } | null,
  documentIds: string[],
  deps: SubmitDeps,
  account: AccountPlan,
): Promise<SubmittedApplication> {
  const { loan, personal, address, employment, financial } = input;
  const reference = generateReference();
  const phone = toE164(personal.phoneNumber, personal.phoneCountry);

  return getDb().transaction(async (tx) => {
    // Details reflect the latest submission (ownership was verified above).
    const applicantValues = {
      firstName: personal.firstName,
      middleName: personal.middleName ?? null,
      lastName: personal.lastName,
      dateOfBirth: personal.dateOfBirth,
      phone,
      countryOfResidence: personal.countryOfResidence,
      nationality: personal.nationality ?? null,
    };
    let applicant: { id: string } | undefined;
    if (account.kind === "new") {
      [applicant] = await tx
        .insert(applicants)
        .values({ ...applicantValues, email: personal.email, passwordHash: account.passwordHash, passwordUpdatedAt: new Date() })
        .onConflictDoNothing({ target: applicants.email })
        .returning({ id: applicants.id });
      // Someone created this account between our check and now.
      if (!applicant) throw new AccountRaceError();
    } else {
      [applicant] = await tx
        .update(applicants)
        .set(applicantValues)
        .where(eq(applicants.id, account.applicantId))
        .returning({ id: applicants.id });
      if (!applicant) throw new Error("Applicant update failed");
    }

    const [application] = await tx
      .insert(applications)
      .values({
        reference,
        applicantId: applicant.id,
        loanProductId: product?.id ?? null,
        status: "SUBMITTED",
        country: address.country,
        idempotencyKey: input.idempotencyKey,
      })
      .returning({ id: applications.id });
    if (!application) throw new Error("Application insert failed");
    const applicationId = application.id;

    await tx.insert(loanRequests).values({
      applicationId,
      purpose: loan.purpose,
      purposeDetails: loan.purposeDetails ?? null,
      amount: loan.amount,
      currency: loan.currency,
      termMonths: Number(loan.termMonths),
      repaymentFrequency: loan.repaymentFrequency,
    });

    await tx.insert(addresses).values({
      applicationId,
      country: address.country,
      region: address.region ?? null,
      city: address.city,
      line1: address.line1,
      line2: address.line2 ?? null,
      postalCode: address.postalCode ?? null,
    });

    await tx.insert(employmentProfiles).values({
      applicationId,
      employmentStatus: employment.employmentStatus,
      employerName: employment.employerName ?? null,
      jobTitle: employment.jobTitle ?? null,
      incomeAmount: employment.incomeAmount,
      incomeCurrency: employment.incomeCurrency,
      incomeFrequency: employment.incomeFrequency,
      monthlyIncome: toMonthlyIncome(employment.incomeAmount, employment.incomeFrequency),
      monthsInRole: employment.monthsInRole ? Number(employment.monthsInRole) : null,
    });

    await tx.insert(financialProfiles).values({
      applicationId,
      currency: financial.currency,
      hasExistingLoans: financial.hasExistingLoans === "yes",
      existingLoanCount: financial.existingLoanCount ? Number(financial.existingLoanCount) : null,
      monthlyDebtPayments: financial.monthlyDebtPayments,
      monthlyExpenses: financial.monthlyExpenses,
      dependents: financial.dependents ? Number(financial.dependents) : null,
      otherCommitments: financial.otherCommitments ?? null,
    });

    await tx.insert(consents).values(
      CONSENT_KEYS.map((key) => ({
        applicationId,
        consentType: key,
        version: CONSENT_VERSIONS[key],
        ipHash: deps.ctx.ipHash,
        userAgent: deps.ctx.userAgent,
      })),
    );

    if (documentIds.length > 0) {
      await tx
        .update(documents)
        .set({ applicationId, status: "ATTACHED", draftTokenHash: null })
        .where(inArray(documents.id, documentIds));
    }

    const actor = { type: "APPLICANT" as const, applicantId: applicant.id };
    await recordEvent(
      {
        applicationId,
        type: "application.submitted",
        summary: "Application submitted",
        actor,
        metadata: { documents: documentIds.length, product: product?.name ?? null },
      },
      tx,
    );
    await recordAudit({ actor, action: "application.submitted", applicationId, ipHash: deps.ctx.ipHash }, tx);

    return {
      id: applicationId,
      applicantId: applicant.id,
      reference,
      email: personal.email,
      firstName: personal.firstName,
      amount: loan.amount,
      currency: loan.currency,
      country: address.country,
      productName: product?.name ?? null,
    };
  });
}
