import { describe, expect, it } from "vitest";
import { APPLICATION_STATUSES } from "@/db/schema/enums";
import { applicantProgress, assertTransition, canTransition, InvalidTransitionError, STATUS_TRANSITIONS } from "@/lib/application/status";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { debtToIncome, toMonthlyIncome } from "@/lib/application/income";
import { evaluateIndicators } from "@/lib/application/eligibility";
import { generateReference, REFERENCE_PATTERN } from "@/lib/application/reference";

describe("status transitions", () => {
  it("defines transitions for every status", () => {
    for (const s of APPLICATION_STATUSES) expect(STATUS_TRANSITIONS[s]).toBeDefined();
  });

  it("allows the happy path", () => {
    const path = ["SUBMITTED", "UNDER_REVIEW", "ELIGIBLE", "ACCOUNT_DETAILS_REQUESTED", "FINAL_REVIEW", "APPROVED", "COMPLETED"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
  });

  it("blocks skipping straight to account details or completion", () => {
    expect(canTransition("SUBMITTED", "ACCOUNT_DETAILS_REQUESTED")).toBe(false);
    expect(canTransition("UNDER_REVIEW", "COMPLETED")).toBe(false);
    expect(canTransition("FINAL_REVIEW", "COMPLETED")).toBe(false); // must be approved first
    expect(canTransition("UNDER_REVIEW", "APPROVED")).toBe(false);
    expect(() => assertTransition("NOT_ELIGIBLE", "ACCOUNT_DETAILS_REQUESTED")).toThrow(InvalidTransitionError);
  });

  it("treats COMPLETED as terminal", () => {
    expect(STATUS_TRANSITIONS.COMPLETED).toHaveLength(0);
  });

  it("produces an applicant-facing tracker", () => {
    const steps = applicantProgress("ACCOUNT_DETAILS_REQUESTED");
    expect(steps.map((s) => s.state)).toEqual(["complete", "complete", "complete", "current", "upcoming", "upcoming"]);
    expect(applicantProgress("APPROVED").every((s) => s.state === "complete")).toBe(true);
    expect(applicantProgress("MORE_INFORMATION_REQUIRED")[1]?.state).toBe("attention");
  });
});

describe("permissions", () => {
  it("gives super admins every permission", () => {
    for (const p of PERMISSIONS) expect(hasPermission("SUPER_ADMIN", p)).toBe(true);
  });

  it("restricts normal admins from sensitive and management actions", () => {
    expect(hasPermission("ADMIN", "applications.review")).toBe(true);
    expect(hasPermission("ADMIN", "account_details.reveal")).toBe(false);
    expect(hasPermission("ADMIN", "admins.manage")).toBe(false);
    expect(hasPermission("ADMIN", "audit.view")).toBe(false);
  });
});

describe("income normalisation", () => {
  it("converts frequencies to monthly amounts", () => {
    expect(toMonthlyIncome("1200", "MONTHLY")).toBe("1200.00");
    expect(toMonthlyIncome("60000", "ANNUALLY")).toBe("5000.00");
    expect(toMonthlyIncome("1000", "WEEKLY")).toBe("4333.33");
    expect(toMonthlyIncome("2000", "BIWEEKLY")).toBe("4333.33");
  });

  it("computes debt-to-income safely", () => {
    expect(debtToIncome("500", "2000")).toBe(0.25);
    expect(debtToIncome("500", "0")).toBeNull();
  });
});

describe("eligibility indicators are advisory", () => {
  const facts = {
    dateOfBirth: "1990-01-01",
    country: "GB",
    employmentStatus: "EMPLOYED_FULL_TIME",
    monthlyIncome: "3000",
    incomeCurrency: "GBP",
    monthlyDebt: "1800",
    debtCurrency: "GBP",
    productCountries: [],
    requiredDocuments: ["government_id_front"],
    uploadedDocumentTypes: [],
  };

  it("flags high DTI and missing documents without deciding", () => {
    const out = evaluateIndicators(
      [
        { ruleType: "MAX_DTI", config: { maxRatio: 0.45 }, description: "" },
        { ruleType: "REQUIRED_DOCUMENTS", config: {}, description: "" },
      ],
      facts,
    );
    expect(out.find((i) => i.key === "dti")?.status).toBe("flag");
    expect(out.find((i) => i.key === "documents")?.status).toBe("flag");
  });

  it("reports unknown when currencies differ", () => {
    const [dti] = evaluateIndicators([{ ruleType: "MAX_DTI", config: {}, description: "" }], { ...facts, debtCurrency: "EUR" });
    expect(dti?.status).toBe("unknown");
  });
});

describe("references", () => {
  it("are random and well-formed", () => {
    const refs = new Set(Array.from({ length: 50 }, () => generateReference(new Date("2026-05-01"))));
    for (const r of refs) expect(r).toMatch(REFERENCE_PATTERN);
    expect(refs.size).toBeGreaterThan(45);
  });
});
