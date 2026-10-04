import { date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, char } from "drizzle-orm/pg-core";
import { createdAt, id, money, updatedAt } from "./columns";
import { installmentStatusEnum, loanStatusEnum, repaymentFrequencyEnum } from "./enums";
import { applicants, applications } from "./applications";
import { admins } from "./auth";

/**
 * An approved loan. Terms are fixed at approval; the repayment schedule lives
 * in loan_installments and payments are recorded by admins in loan_payments.
 */
export const loans = pgTable(
  "loans",
  {
    id: id(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "restrict" }),
    applicantId: uuid("applicant_id")
      .notNull()
      .references(() => applicants.id, { onDelete: "restrict" }),
    status: loanStatusEnum("status").notNull().default("PENDING_DISBURSEMENT"),
    principal: money("principal").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    /** Flat interest rate, percent per annum. */
    interestRate: numeric("interest_rate", { precision: 7, scale: 4 }).notNull(),
    totalInterest: money("total_interest").notNull(),
    totalRepayable: money("total_repayable").notNull(),
    termMonths: integer("term_months").notNull(),
    repaymentFrequency: repaymentFrequencyEnum("repayment_frequency").notNull(),
    installmentCount: integer("installment_count").notNull(),
    firstDueDate: date("first_due_date").notNull(),
    approvedByAdminId: uuid("approved_by_admin_id").references(() => admins.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }).notNull().defaultNow(),
    disbursedAt: timestamp("disbursed_at", { withTimezone: true }),
    paidOffAt: timestamp("paid_off_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("loans_application_idx").on(t.applicationId),
    index("loans_applicant_idx").on(t.applicantId),
    index("loans_status_idx").on(t.status),
  ],
);

export const loanInstallments = pgTable(
  "loan_installments",
  {
    id: id(),
    loanId: uuid("loan_id")
      .notNull()
      .references(() => loans.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    dueDate: date("due_date").notNull(),
    principalDue: money("principal_due").notNull(),
    interestDue: money("interest_due").notNull(),
    amountDue: money("amount_due").notNull(),
    amountPaid: money("amount_paid").notNull().default("0"),
    status: installmentStatusEnum("status").notNull().default("PENDING"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("loan_installments_seq_idx").on(t.loanId, t.sequence), index("loan_installments_due_idx").on(t.dueDate, t.status)],
);

/** Payments recorded by admins. Voided payments are kept for the audit trail. */
export const loanPayments = pgTable(
  "loan_payments",
  {
    id: id(),
    loanId: uuid("loan_id")
      .notNull()
      .references(() => loans.id, { onDelete: "cascade" }),
    amount: money("amount").notNull(),
    paidOn: date("paid_on").notNull(),
    /** bank_transfer | cash | mobile_money | card | other */
    method: text("method").notNull(),
    reference: text("reference"),
    note: text("note"),
    recordedByAdminId: uuid("recorded_by_admin_id").references(() => admins.id, { onDelete: "set null" }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedByAdminId: uuid("voided_by_admin_id").references(() => admins.id, { onDelete: "set null" }),
    voidReason: text("void_reason"),
    createdAt: createdAt(),
  },
  (t) => [index("loan_payments_loan_idx").on(t.loanId)],
);

/** One row per reminder actually sent, so each reminder goes out at most once. */
export const loanReminders = pgTable(
  "loan_reminders",
  {
    id: id(),
    installmentId: uuid("installment_id")
      .notNull()
      .references(() => loanInstallments.id, { onDelete: "cascade" }),
    /** UPCOMING | DUE_TODAY | OVERDUE_1 | OVERDUE_7 */
    kind: text("kind").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("loan_reminders_unique_idx").on(t.installmentId, t.kind)],
);

/**
 * Key/value system settings editable by super admins (e.g. email provider,
 * repayment instructions). Secrets inside values are encrypted by the app.
 */
export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
  updatedByAdminId: uuid("updated_by_admin_id").references(() => admins.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});
