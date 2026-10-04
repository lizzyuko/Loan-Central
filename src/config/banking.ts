import type { BankScheme } from "./countries";

/**
 * Banking identifier requirements per scheme. The account-details form and its
 * server-side validation are both generated from this table, so adding a
 * country-specific format is a configuration change.
 */

export type BankFieldKey =
  | "accountNumber"
  | "iban"
  | "swiftBic"
  | "routingNumber"
  | "sortCode"
  | "transitNumber"
  | "institutionNumber"
  | "bsb"
  | "ifsc";

export interface BankFieldSpec {
  key: BankFieldKey;
  label: string;
  hint?: string;
  required: boolean;
  /** Validated after removing spaces and dashes, case-insensitively. */
  pattern: string;
  inputMode?: "numeric" | "text";
  maxLength: number;
}

const F = {
  accountNumber: (required = true): BankFieldSpec => ({
    key: "accountNumber",
    label: "Account number",
    required,
    pattern: "^[A-Z0-9]{4,34}$",
    inputMode: "text",
    maxLength: 40,
  }),
  iban: (required = true): BankFieldSpec => ({
    key: "iban",
    label: "IBAN",
    hint: "International Bank Account Number, e.g. DE89 3704 0044 0532 0130 00",
    required,
    pattern: "^[A-Z]{2}\\d{2}[A-Z0-9]{11,30}$",
    maxLength: 42,
  }),
  swiftBic: (required = false): BankFieldSpec => ({
    key: "swiftBic",
    label: "SWIFT / BIC",
    hint: "8 or 11 characters",
    required,
    pattern: "^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$",
    maxLength: 11,
  }),
  routingNumber: (): BankFieldSpec => ({
    key: "routingNumber",
    label: "Routing number (ABA)",
    hint: "9 digits",
    required: true,
    pattern: "^\\d{9}$",
    inputMode: "numeric",
    maxLength: 9,
  }),
  sortCode: (): BankFieldSpec => ({
    key: "sortCode",
    label: "Sort code",
    hint: "6 digits, e.g. 12-34-56",
    required: true,
    pattern: "^\\d{6}$",
    inputMode: "numeric",
    maxLength: 8,
  }),
  transitNumber: (): BankFieldSpec => ({
    key: "transitNumber",
    label: "Transit number",
    hint: "5 digits",
    required: true,
    pattern: "^\\d{5}$",
    inputMode: "numeric",
    maxLength: 5,
  }),
  institutionNumber: (): BankFieldSpec => ({
    key: "institutionNumber",
    label: "Institution number",
    hint: "3 digits",
    required: true,
    pattern: "^\\d{3}$",
    inputMode: "numeric",
    maxLength: 3,
  }),
  bsb: (): BankFieldSpec => ({
    key: "bsb",
    label: "BSB",
    hint: "6 digits",
    required: true,
    pattern: "^\\d{6}$",
    inputMode: "numeric",
    maxLength: 7,
  }),
  ifsc: (): BankFieldSpec => ({
    key: "ifsc",
    label: "IFSC",
    hint: "11 characters, e.g. HDFC0001234",
    required: true,
    pattern: "^[A-Z]{4}0[A-Z0-9]{6}$",
    maxLength: 11,
  }),
};

export const BANK_SCHEMES: Record<BankScheme, BankFieldSpec[]> = {
  IBAN: [F.iban(), F.swiftBic()],
  US_ROUTING: [F.routingNumber(), F.accountNumber()],
  UK_SORT_CODE: [F.sortCode(), { ...F.accountNumber(), pattern: "^\\d{8}$", hint: "8 digits", inputMode: "numeric" }],
  CA_TRANSIT: [F.transitNumber(), F.institutionNumber(), F.accountNumber()],
  AU_BSB: [F.bsb(), F.accountNumber()],
  IN_IFSC: [F.ifsc(), F.accountNumber()],
  GENERIC: [F.accountNumber(), F.swiftBic(true)],
};

/** Which field the masked "••••1234" hint is derived from, in priority order. */
export const MASK_SOURCE_PRIORITY: BankFieldKey[] = ["accountNumber", "iban"];

export function normalizeBankValue(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export function maskIdentifier(value: string): string {
  const v = normalizeBankValue(value);
  return `••••${v.slice(-4)}`;
}
