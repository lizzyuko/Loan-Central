import {
  boolean,
  char,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, money, updatedAt } from "./columns";
import {
  applicationStatusEnum,
  employmentStatusEnum,
  incomeFrequencyEnum,
  repaymentFrequencyEnum,
} from "./enums";
import { loanProducts } from "./products";

/** A person who has applied. Identified by (normalised) email. */
export const applicants = pgTable(
  "applicants",
  {
    id: id(),
    email: text("email").notNull(), // always lower-cased
    firstName: text("first_name").notNull(),
    middleName: text("middle_name"),
    lastName: text("last_name").notNull(),
    dateOfBirth: date("date_of_birth").notNull(),
    phone: text("phone").notNull(), // E.164
    countryOfResidence: char("country_of_residence", { length: 2 }).notNull(),
    nationality: char("nationality", { length: 2 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("applicants_email_idx").on(t.email)],
);

export const applications = pgTable(
  "applications",
  {
    id: id(),
    /** Public, random, non-sequential reference, e.g. LC-2026-104829. */
    reference: text("reference").notNull(),
    applicantId: uuid("applicant_id")
      .notNull()
      .references(() => applicants.id, { onDelete: "restrict" }),
    loanProductId: uuid("loan_product_id").references(() => loanProducts.id, {
      onDelete: "set null",
    }),
    status: applicationStatusEnum("status").notNull().default("SUBMITTED"),
    /** Denormalised from the address for fast filtering. */
    country: char("country", { length: 2 }).notNull(),
    /** Client-generated key that makes submission idempotent. */
    idempotencyKey: text("idempotency_key").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).notNull().defaultNow(),
    firstViewedAt: timestamp("first_viewed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("applications_reference_idx").on(t.reference),
    uniqueIndex("applications_idempotency_idx").on(t.idempotencyKey),
    index("applications_applicant_idx").on(t.applicantId),
    index("applications_status_idx").on(t.status),
    index("applications_country_idx").on(t.country),
    index("applications_created_idx").on(t.createdAt),
  ],
);

export const loanRequests = pgTable(
  "loan_requests",
  {
    id: id(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    purposeDetails: text("purpose_details"),
    amount: money("amount").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    termMonths: integer("term_months").notNull(),
    repaymentFrequency: repaymentFrequencyEnum("repayment_frequency").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("loan_requests_application_idx").on(t.applicationId)],
);

export const addresses = pgTable(
  "addresses",
  {
    id: id(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    country: char("country", { length: 2 }).notNull(),
    region: text("region"),
    city: text("city").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    postalCode: text("postal_code"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("addresses_application_idx").on(t.applicationId)],
);

export const employmentProfiles = pgTable(
  "employment_profiles",
  {
    id: id(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    employmentStatus: employmentStatusEnum("employment_status").notNull(),
    employerName: text("employer_name"),
    jobTitle: text("job_title"),
    incomeAmount: money("income_amount").notNull(),
    incomeCurrency: char("income_currency", { length: 3 }).notNull(),
    incomeFrequency: incomeFrequencyEnum("income_frequency").notNull(),
    /** Income normalised to a monthly figure in incomeCurrency. */
    monthlyIncome: money("monthly_income").notNull(),
    monthsInRole: integer("months_in_role"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("employment_profiles_application_idx").on(t.applicationId)],
);

export const financialProfiles = pgTable(
  "financial_profiles",
  {
    id: id(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    currency: char("currency", { length: 3 }).notNull(),
    hasExistingLoans: boolean("has_existing_loans").notNull(),
    existingLoanCount: integer("existing_loan_count"),
    monthlyDebtPayments: money("monthly_debt_payments").notNull(),
    monthlyExpenses: money("monthly_expenses").notNull(),
    dependents: integer("dependents"),
    otherCommitments: text("other_commitments"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("financial_profiles_application_idx").on(t.applicationId)],
);

export const consents = pgTable(
  "consents",
  {
    id: id(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    /** e.g. "terms", "privacy", "disclosure", "contact" */
    consentType: text("consent_type").notNull(),
    /** Version of the legal document accepted (src/content/legal). */
    version: text("version").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
  },
  (t) => [index("consents_application_idx").on(t.applicationId)],
);
