import { describe, expect, it } from "vitest";
import {
  addressSchema,
  applicationSubmissionSchema,
  consentSchema,
  employmentSchema,
  financialSchema,
  loanDetailsSchema,
  personalInfoSchema,
} from "@/lib/validation/application";

export const validPersonal = {
  firstName: "Amara",
  middleName: "",
  lastName: "Okafor",
  dateOfBirth: "1990-04-12",
  email: "  Amara.Okafor@Example.com ",
  phoneCountry: "GB",
  phoneNumber: "07911 123456",
  countryOfResidence: "GB",
  nationality: "",
};

export const validSubmission = {
  idempotencyKey: "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e",
  turnstileToken: "token",
  password: "river-lantern-copper-71",
  loan: { productSlug: "", purpose: "personal", purposeDetails: "", amount: "12,500", currency: "GBP", termMonths: "24", repaymentFrequency: "MONTHLY" },
  personal: validPersonal,
  address: { country: "GB", region: "", city: "Leeds", line1: "18 Park Square East", line2: "", postalCode: "LS1 2NE" },
  employment: { employmentStatus: "EMPLOYED_FULL_TIME", employerName: "Acorn Ltd", jobTitle: "", incomeAmount: "3200", incomeCurrency: "GBP", incomeFrequency: "MONTHLY", monthsInRole: "14" },
  financial: { hasExistingLoans: "no", existingLoanCount: "", monthlyDebtPayments: "0", monthlyExpenses: "1400", currency: "GBP", dependents: "", otherCommitments: "" },
  documents: { documentIds: [] },
  consent: { terms: true, privacy: true, disclosure: true, accuracy: true },
};

describe("loan details", () => {
  it("normalises amounts and accepts any supported currency", () => {
    const r = loanDetailsSchema.parse({ ...validSubmission.loan, amount: "1,000,000.50", currency: "inr" });
    expect(r.amount).toBe("1000000.50");
    expect(r.currency).toBe("INR");
  });

  it("rejects unsupported currencies and non-numeric amounts", () => {
    expect(loanDetailsSchema.safeParse({ ...validSubmission.loan, currency: "XYZ" }).success).toBe(false);
    expect(loanDetailsSchema.safeParse({ ...validSubmission.loan, amount: "lots" }).success).toBe(false);
    expect(loanDetailsSchema.safeParse({ ...validSubmission.loan, amount: "0" }).success).toBe(false);
  });
});

describe("personal information", () => {
  it("lower-cases and trims email, accepts international names", () => {
    const r = personalInfoSchema.parse({ ...validPersonal, firstName: "José-María", lastName: "Ó Briain" });
    expect(r.email).toBe("amara.okafor@example.com");
  });

  it("rejects applicants under 18", () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 17);
    const r = personalInfoSchema.safeParse({ ...validPersonal, dateOfBirth: dob.toISOString().slice(0, 10) });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["dateOfBirth"]);
  });

  it("validates phone numbers against the chosen country (no single-country assumption)", () => {
    expect(personalInfoSchema.safeParse({ ...validPersonal, phoneCountry: "NG", phoneNumber: "0803 123 4567" }).success).toBe(true);
    expect(personalInfoSchema.safeParse({ ...validPersonal, phoneCountry: "US", phoneNumber: "212 555 0123" }).success).toBe(true);
    expect(personalInfoSchema.safeParse({ ...validPersonal, phoneCountry: "GB", phoneNumber: "123" }).success).toBe(false);
  });

  it("rejects names containing markup", () => {
    expect(personalInfoSchema.safeParse({ ...validPersonal, firstName: "<script>" }).success).toBe(false);
  });
});

describe("address", () => {
  it("applies country-specific requirements", () => {
    const us = { country: "US", region: "", city: "Austin", line1: "1 Main St", line2: "", postalCode: "" };
    const r = addressSchema.safeParse(us);
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path[0]);
    expect(paths).toContain("region");
    expect(paths).toContain("postalCode");
    expect(addressSchema.safeParse({ ...us, region: "TX", postalCode: "78701" }).success).toBe(true);
  });

  it("does not require postcodes where they are not used", () => {
    expect(addressSchema.safeParse({ country: "GH", region: "Greater Accra", city: "Accra", line1: "7 Oxford St", line2: "", postalCode: "" }).success).toBe(true);
  });
});

describe("employment & financial", () => {
  it("requires an employer for employed applicants only", () => {
    expect(employmentSchema.safeParse({ ...validSubmission.employment, employerName: "" }).success).toBe(false);
    expect(employmentSchema.safeParse({ ...validSubmission.employment, employmentStatus: "RETIRED", employerName: "" }).success).toBe(true);
  });

  it("requires a loan count when existing loans are declared", () => {
    expect(financialSchema.safeParse({ ...validSubmission.financial, hasExistingLoans: "yes" }).success).toBe(false);
    expect(financialSchema.safeParse({ ...validSubmission.financial, hasExistingLoans: "yes", existingLoanCount: "2" }).success).toBe(true);
  });
});

describe("full submission", () => {
  it("accepts a complete application", () => {
    expect(applicationSubmissionSchema.safeParse(validSubmission).success).toBe(true);
  });

  it("requires every consent", () => {
    expect(consentSchema.safeParse({ terms: true, privacy: true, disclosure: false, accuracy: true }).success).toBe(false);
  });

  it("requires a password", () => {
    expect(applicationSubmissionSchema.safeParse({ ...validSubmission, password: "" }).success).toBe(false);
  });

  it("requires a UUID idempotency key", () => {
    expect(applicationSubmissionSchema.safeParse({ ...validSubmission, idempotencyKey: "1" }).success).toBe(false);
  });
});
