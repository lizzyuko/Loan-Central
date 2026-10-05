import type { EmploymentStatus, IncomeFrequency, RepaymentFrequency } from "@/db/schema/enums";

export const siteConfig = {
  name: "Loan Central",
  tagline: "Find loan options that fit your needs.",
  description:
    "Apply once and let the Loan Central team review your application and the options that may be available to you. Submitting an application does not guarantee approval or a loan offer.",
  supportEmail: "support@loancentral.site",
  /** Shown on the confirmation screen and FAQ. Keep it honest. */
  typicalReviewTime: "3 to 5 business days",
  locale: "en",
} as const;

/** Loan purposes. Product records reference these keys via `purposeKey`. */
export const LOAN_PURPOSES = [
  { value: "personal", label: "Personal expenses" },
  { value: "debt_consolidation", label: "Debt consolidation" },
  { value: "home_improvement", label: "Home improvement" },
  { value: "medical", label: "Medical expenses" },
  { value: "education", label: "Education" },
  { value: "business", label: "Business" },
  { value: "auto", label: "Vehicle purchase" },
  { value: "other", label: "Something else" },
] as const;
export type LoanPurpose = (typeof LOAN_PURPOSES)[number]["value"];
export const LOAN_PURPOSE_VALUES = LOAN_PURPOSES.map((p) => p.value) as [LoanPurpose, ...LoanPurpose[]];

export const DEFAULT_TERM_OPTIONS_MONTHS = [6, 12, 18, 24, 36, 48, 60] as const;

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  EMPLOYED_FULL_TIME: "Employed full-time",
  EMPLOYED_PART_TIME: "Employed part-time",
  SELF_EMPLOYED: "Self-employed",
  BUSINESS_OWNER: "Business owner",
  CONTRACTOR: "Contractor / freelancer",
  STUDENT: "Student",
  RETIRED: "Retired",
  UNEMPLOYED: "Not currently employed",
  OTHER: "Other",
};

/** Statuses for which an employer / business name is expected. */
export const EMPLOYER_REQUIRED_STATUSES: EmploymentStatus[] = [
  "EMPLOYED_FULL_TIME",
  "EMPLOYED_PART_TIME",
  "SELF_EMPLOYED",
  "BUSINESS_OWNER",
  "CONTRACTOR",
];

export const INCOME_FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Every two weeks",
  MONTHLY: "Monthly",
  ANNUALLY: "Annually",
};

export const REPAYMENT_FREQUENCY_LABELS: Record<RepaymentFrequency, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Every two weeks",
  MONTHLY: "Monthly",
};

/** Upload constraints — enforced in the browser AND on the server/Cloudinary. */
export const UPLOAD_RULES = {
  maxBytes: 10 * 1024 * 1024,
  maxFilesPerApplication: 12,
  /** Cloudinary `format` values we accept, mapped to MIME types. */
  allowedFormats: {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
  } as Record<string, string>,
  accept: ".pdf,.jpg,.jpeg,.png,.webp,.heic,application/pdf,image/jpeg,image/png,image/webp,image/heic",
} as const;

/** Retention period for encrypted account details after completion. */
export const ACCOUNT_DETAILS_RETENTION_DAYS = 180;
