import type {
  AddressInput,
  ConsentInput,
  EmploymentInput,
  FinancialInput,
  LoanDetailsInput,
  PersonalInfoInput,
} from "@/lib/validation/application";

export interface UploadedDocument {
  id: string;
  documentType: string;
  filename: string;
  bytes: number;
}

export interface WizardData {
  loan?: LoanDetailsInput;
  personal?: PersonalInfoInput;
  address?: AddressInput;
  employment?: EmploymentInput;
  financial?: FinancialInput;
  documents: UploadedDocument[];
  consent?: Partial<ConsentInput>;
}

export interface WizardProduct {
  slug: string;
  name: string;
  shortDescription: string;
  purposeKey: string;
  minAmount: string;
  maxAmount: string;
  baseCurrency: string;
  supportedCurrencies: string[];
  termOptionsMonths: number[];
  requiredDocumentTypes: string[];
}

export interface WizardDocumentType {
  key: string;
  label: string;
  description: string;
}

export const STEPS = [
  { key: "loan", title: "Loan details", short: "Loan" },
  { key: "personal", title: "About you", short: "You" },
  { key: "address", title: "Your address", short: "Address" },
  { key: "employment", title: "Employment & income", short: "Income" },
  { key: "financial", title: "Your finances", short: "Finances" },
  { key: "documents", title: "Documents", short: "Documents" },
  { key: "review", title: "Review & submit", short: "Review" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];


export { DEFAULT_REQUIRED_DOCUMENTS } from "@/config/documents";
