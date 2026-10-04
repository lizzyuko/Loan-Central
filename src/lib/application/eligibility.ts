import { ageOn } from "@/lib/validation/fields";
import { debtToIncome } from "./income";

/**
 * ADVISORY indicators for reviewers. These never change an application's
 * status and never make a lending decision; a person always decides.
 */

export type IndicatorStatus = "pass" | "flag" | "unknown";

export interface Indicator {
  key: string;
  label: string;
  status: IndicatorStatus;
  detail: string;
}

export interface EligibilityRule {
  ruleType: string;
  config: Record<string, unknown>;
  description: string;
}

export interface EligibilityFacts {
  dateOfBirth: string;
  country: string;
  employmentStatus: string;
  monthlyIncome: string;
  incomeCurrency: string;
  monthlyDebt: string;
  debtCurrency: string;
  productCountries: string[];
  requiredDocuments: string[];
  uploadedDocumentTypes: string[];
  now?: Date;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function evaluateIndicators(rules: EligibilityRule[], f: EligibilityFacts): Indicator[] {
  const out: Indicator[] = [];
  for (const rule of rules) {
    switch (rule.ruleType) {
      case "MIN_AGE": {
        const min = num(rule.config.minAge) ?? 18;
        const age = ageOn(f.dateOfBirth, f.now);
        out.push({ key: "age", label: "Minimum age", status: age >= min ? "pass" : "flag", detail: `Applicant is ${age}; guideline minimum is ${min}.` });
        break;
      }
      case "MAX_DTI": {
        const max = num(rule.config.maxRatio) ?? 0.45;
        if (f.incomeCurrency !== f.debtCurrency) {
          out.push({ key: "dti", label: "Debt-to-income", status: "unknown", detail: `Income (${f.incomeCurrency}) and debts (${f.debtCurrency}) are in different currencies.` });
          break;
        }
        const dti = debtToIncome(f.monthlyDebt, f.monthlyIncome);
        if (dti === null) {
          out.push({ key: "dti", label: "Debt-to-income", status: "unknown", detail: "No monthly income reported." });
          break;
        }
        out.push({
          key: "dti",
          label: "Debt-to-income",
          status: dti <= max ? "pass" : "flag",
          detail: `${(dti * 100).toFixed(1)}% of monthly income goes to debt repayments (guideline ${Math.round(max * 100)}%).`,
        });
        break;
      }
      case "MIN_MONTHLY_INCOME": {
        const min = num(rule.config.amount);
        const currency = typeof rule.config.currency === "string" ? rule.config.currency : null;
        if (min === null || !currency) break;
        if (currency !== f.incomeCurrency) {
          out.push({ key: "income", label: "Minimum income", status: "unknown", detail: `Guideline is in ${currency}; income reported in ${f.incomeCurrency}.` });
          break;
        }
        const income = Number(f.monthlyIncome);
        out.push({ key: "income", label: "Minimum income", status: income >= min ? "pass" : "flag", detail: `Monthly income ${income.toFixed(2)} ${currency}; guideline ${min} ${currency}.` });
        break;
      }
      case "COUNTRY_ALLOWED": {
        if (f.productCountries.length === 0) break;
        const ok = f.productCountries.includes(f.country);
        out.push({ key: "country", label: "Country availability", status: ok ? "pass" : "flag", detail: ok ? "Product is offered in the applicant's country." : "Product is not configured for the applicant's country." });
        break;
      }
      case "EMPLOYMENT_STATUS": {
        const allowed = Array.isArray(rule.config.allowed) ? (rule.config.allowed as string[]) : [];
        if (allowed.length === 0) break;
        const ok = allowed.includes(f.employmentStatus);
        out.push({ key: "employment", label: "Employment status", status: ok ? "pass" : "flag", detail: rule.description });
        break;
      }
      case "REQUIRED_DOCUMENTS": {
        const missing = f.requiredDocuments.filter((d) => !f.uploadedDocumentTypes.includes(d));
        out.push({
          key: "documents",
          label: "Required documents",
          status: missing.length === 0 ? "pass" : "flag",
          detail: missing.length === 0 ? "All required documents are uploaded." : `Missing: ${missing.join(", ")}.`,
        });
        break;
      }
    }
  }
  return out;
}
