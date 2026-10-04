import { z } from "zod";
import { isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";
import { getCountry } from "@/config/countries";
import { EMPLOYER_REQUIRED_STATUSES, LOAN_PURPOSE_VALUES } from "@/config/site";
import { EMPLOYMENT_STATUSES, INCOME_FREQUENCIES, REPAYMENT_FREQUENCIES } from "@/db/schema/enums";
import {
  ageOn,
  countryCode,
  currencyCode,
  email,
  integerString,
  isoDate,
  moneyAmount,
  optionalText,
  personName,
  requiredText,
} from "./fields";

/**
 * One schema per wizard step. Each step validates independently in the
 * browser; the server re-validates the combined `applicationSubmissionSchema`.
 * All inputs are strings (as produced by form controls).
 */

export const MIN_APPLICANT_AGE = 18;
export const MAX_APPLICANT_AGE = 100;

export const loanDetailsSchema = z.object({
  productSlug: z.string().trim().max(80).optional().or(z.literal("")),
  purpose: z.enum(LOAN_PURPOSE_VALUES, { error: "Select a loan purpose" }),
  purposeDetails: optionalText("Purpose details", 500),
  amount: moneyAmount("Loan amount", { min: 1, max: 100_000_000 }),
  currency: currencyCode,
  termMonths: integerString("Repayment period", { min: 1, max: 360 }),
  repaymentFrequency: z.enum(REPAYMENT_FREQUENCIES, { error: "Select a repayment frequency" }),
});

export const personalInfoSchema = z
  .object({
    firstName: personName("First name"),
    middleName: optionalText("Middle name", 80),
    lastName: personName("Last name"),
    dateOfBirth: isoDate,
    email,
    phoneCountry: countryCode("Phone country"),
    phoneNumber: requiredText("Phone number", 30),
    countryOfResidence: countryCode("Country of residence"),
    nationality: countryCode("Nationality").optional().or(z.literal("").transform(() => undefined)),
  })
  .superRefine((v, ctx) => {
    const age = ageOn(v.dateOfBirth);
    if (age < MIN_APPLICANT_AGE) {
      ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: `You must be at least ${MIN_APPLICANT_AGE} to apply` });
    } else if (age > MAX_APPLICANT_AGE || Date.parse(v.dateOfBirth) > Date.now()) {
      ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Enter a valid date of birth" });
    }
    if (!isValidPhoneNumber(v.phoneNumber, v.phoneCountry as CountryCode)) {
      ctx.addIssue({ code: "custom", path: ["phoneNumber"], message: "Enter a valid phone number for the selected country" });
    }
  });

export const addressSchema = z
  .object({
    country: countryCode(),
    region: optionalText("Region", 100),
    city: requiredText("City / town", 100),
    line1: requiredText("Address line 1", 200),
    line2: optionalText("Address line 2", 200),
    postalCode: optionalText("Postal code", 20),
  })
  .superRefine((v, ctx) => {
    const cfg = getCountry(v.country);
    if (!cfg) return;
    if (cfg.address.regionRequired && !v.region) {
      ctx.addIssue({ code: "custom", path: ["region"], message: `${cfg.address.regionLabel} is required` });
    }
    if (cfg.address.postalRequired && !v.postalCode) {
      ctx.addIssue({ code: "custom", path: ["postalCode"], message: `${cfg.address.postalLabel} is required` });
    }
    if (v.postalCode && cfg.address.postalPattern && !new RegExp(cfg.address.postalPattern).test(v.postalCode)) {
      ctx.addIssue({ code: "custom", path: ["postalCode"], message: `Enter a valid ${cfg.address.postalLabel.toLowerCase()}` });
    }
  });

export const employmentSchema = z
  .object({
    employmentStatus: z.enum(EMPLOYMENT_STATUSES, { error: "Select your employment status" }),
    employerName: optionalText("Employer / business name", 150),
    jobTitle: optionalText("Job title / business type", 120),
    incomeAmount: moneyAmount("Income", { min: 0, max: 1_000_000_000 }),
    incomeCurrency: currencyCode,
    incomeFrequency: z.enum(INCOME_FREQUENCIES, { error: "Select how often you receive this income" }),
    monthsInRole: integerString("Time in role", { min: 0, max: 720, optional: true }),
  })
  .superRefine((v, ctx) => {
    if (EMPLOYER_REQUIRED_STATUSES.includes(v.employmentStatus) && !v.employerName) {
      ctx.addIssue({ code: "custom", path: ["employerName"], message: "Employer or business name is required" });
    }
  });

export const financialSchema = z
  .object({
    hasExistingLoans: z.enum(["yes", "no"], { error: "Tell us whether you have existing loans" }),
    existingLoanCount: integerString("Number of loans", { min: 0, max: 50, optional: true }),
    monthlyDebtPayments: moneyAmount("Monthly debt payments", { min: 0 }),
    monthlyExpenses: moneyAmount("Monthly expenses", { min: 0 }),
    currency: currencyCode,
    dependents: integerString("Dependents", { min: 0, max: 30, optional: true }),
    otherCommitments: optionalText("Other commitments", 1000),
  })
  .superRefine((v, ctx) => {
    if (v.hasExistingLoans === "yes" && !v.existingLoanCount) {
      ctx.addIssue({ code: "custom", path: ["existingLoanCount"], message: "Enter how many loans you currently have" });
    }
  });

export const documentsSchema = z.object({
  documentIds: z.array(z.uuid()).max(20),
});

export const CONSENT_KEYS = ["terms", "privacy", "disclosure", "accuracy"] as const;
export type ConsentKey = (typeof CONSENT_KEYS)[number];

export const consentSchema = z.object({
  terms: z.literal(true, { error: "You must accept the Terms of Use" }),
  privacy: z.literal(true, { error: "You must acknowledge the Privacy Policy" }),
  disclosure: z.literal(true, { error: "You must acknowledge the loan disclosure" }),
  accuracy: z.literal(true, { error: "You must confirm your information is accurate" }),
});

export const applicationSubmissionSchema = z.object({
  idempotencyKey: z.uuid(),
  turnstileToken: z.string().min(1).max(2048),
  /**
   * New applicants create their account password here; returning applicants
   * enter their existing one. The new-password policy is checked server-side
   * only when a new account is created.
   */
  password: z.string().min(1, { error: "Enter a password" }).max(128),
  loan: loanDetailsSchema,
  personal: personalInfoSchema,
  address: addressSchema,
  employment: employmentSchema,
  financial: financialSchema,
  documents: documentsSchema,
  consent: consentSchema,
});

export type LoanDetailsInput = z.input<typeof loanDetailsSchema>;
export type PersonalInfoInput = z.input<typeof personalInfoSchema>;
export type AddressInput = z.input<typeof addressSchema>;
export type EmploymentInput = z.input<typeof employmentSchema>;
export type FinancialInput = z.input<typeof financialSchema>;
export type ConsentInput = z.input<typeof consentSchema>;
export type ApplicationSubmissionInput = z.input<typeof applicationSubmissionSchema>;
export type ApplicationSubmission = z.output<typeof applicationSubmissionSchema>;

export function toE164(phoneNumber: string, phoneCountry: string): string {
  const parsed = parsePhoneNumberFromString(phoneNumber, phoneCountry as CountryCode);
  if (!parsed?.isValid()) throw new Error("Invalid phone number");
  return parsed.number;
}
