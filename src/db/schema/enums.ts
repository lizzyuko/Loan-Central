import { pgEnum } from "drizzle-orm/pg-core";

export const APPLICATION_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "MORE_INFORMATION_REQUIRED",
  "ELIGIBLE",
  "NOT_ELIGIBLE",
  "ACCOUNT_DETAILS_REQUESTED",
  "FINAL_REVIEW",
  "APPROVED",
  "COMPLETED",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const EMPLOYMENT_STATUSES = [
  "EMPLOYED_FULL_TIME",
  "EMPLOYED_PART_TIME",
  "SELF_EMPLOYED",
  "BUSINESS_OWNER",
  "CONTRACTOR",
  "STUDENT",
  "RETIRED",
  "UNEMPLOYED",
  "OTHER",
] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const INCOME_FREQUENCIES = ["WEEKLY", "BIWEEKLY", "MONTHLY", "ANNUALLY"] as const;
export type IncomeFrequency = (typeof INCOME_FREQUENCIES)[number];

export const REPAYMENT_FREQUENCIES = ["WEEKLY", "BIWEEKLY", "MONTHLY"] as const;
export type RepaymentFrequency = (typeof REPAYMENT_FREQUENCIES)[number];

export const COMMUNICATION_TYPES = [
  "APPLICATION_CONFIRMATION",
  "ADMIN_NOTIFICATION",
  "STATUS_UPDATE",
  "INFORMATION_REQUEST",
  "ELIGIBILITY_DECISION",
  "ACCOUNT_DETAILS_REQUEST",
  "CUSTOM_MESSAGE",
  "VERIFICATION",
  "LOAN_APPROVED",
  "PAYMENT_RECEIVED",
  "PAYMENT_REMINDER",
  "PAYMENT_OVERDUE",
  "LOAN_PAID_OFF",
] as const;
export type CommunicationType = (typeof COMMUNICATION_TYPES)[number];

export const DELIVERY_STATUSES = ["QUEUED", "SENT", "FAILED", "SKIPPED"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const ACTOR_TYPES = ["ADMIN", "APPLICANT", "SYSTEM"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const DOCUMENT_STATUSES = ["PENDING", "ATTACHED", "DELETED"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const INFO_REQUEST_STATUSES = ["OPEN", "FULFILLED", "CANCELLED"] as const;
export type InfoRequestStatus = (typeof INFO_REQUEST_STATUSES)[number];

export const LOAN_STATUSES = ["PENDING_DISBURSEMENT", "ACTIVE", "PAID_OFF", "DEFAULTED", "CANCELLED"] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export const INSTALLMENT_STATUSES = ["PENDING", "PARTIAL", "PAID"] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export const REMINDER_KINDS = ["UPCOMING", "DUE_TODAY", "OVERDUE_1", "OVERDUE_7"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export const applicationStatusEnum = pgEnum("application_status", APPLICATION_STATUSES);
export const adminRoleEnum = pgEnum("admin_role", ADMIN_ROLES);
export const employmentStatusEnum = pgEnum("employment_status", EMPLOYMENT_STATUSES);
export const incomeFrequencyEnum = pgEnum("income_frequency", INCOME_FREQUENCIES);
export const repaymentFrequencyEnum = pgEnum("repayment_frequency", REPAYMENT_FREQUENCIES);
export const communicationTypeEnum = pgEnum("communication_type", COMMUNICATION_TYPES);
export const deliveryStatusEnum = pgEnum("delivery_status", DELIVERY_STATUSES);
export const actorTypeEnum = pgEnum("actor_type", ACTOR_TYPES);
export const documentStatusEnum = pgEnum("document_status", DOCUMENT_STATUSES);
export const infoRequestStatusEnum = pgEnum("info_request_status", INFO_REQUEST_STATUSES);
export const loanStatusEnum = pgEnum("loan_status", LOAN_STATUSES);
export const installmentStatusEnum = pgEnum("installment_status", INSTALLMENT_STATUSES);
