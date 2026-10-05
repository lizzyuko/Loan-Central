/**
 * National identity numbers collected per country of residence.
 * Countries listed here REQUIRE their number; every other country gets an
 * optional "national ID or passport number" field. Add or change entries here;
 * the wizard and server validation both read this table.
 *
 * Values are highly sensitive: encrypted at rest, masked in the admin UI and
 * never emailed or logged.
 */

export interface NationalIdSpec {
  /** Short code stored with the value, e.g. "SSN". */
  type: string;
  label: string;
  hint: string;
  required: boolean;
  /** Checked after removing spaces and dashes, upper-cased. */
  pattern: RegExp;
  inputMode?: "numeric" | "text";
  /** Extra check beyond the pattern (e.g. a checksum). */
  check?: (normalized: string) => boolean;
}

/** Luhn checksum (used by Canadian SINs). */
function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

const SPECS: Record<string, NationalIdSpec> = {
  NG: { type: "NIN", label: "National Identification Number (NIN)", hint: "11 digits, from your NIMC slip or ID card", required: true, pattern: /^\d{11}$/, inputMode: "numeric" },
  US: {
    type: "SSN",
    label: "Social Security Number (SSN)",
    hint: "9 digits, e.g. 123-45-6789",
    required: true,
    pattern: /^\d{9}$/,
    inputMode: "numeric",
    // Area 000, 666 and 900-999, group 00 and serial 0000 are never issued.
    check: (v) => !/^(000|666|9)/.test(v) && v.slice(3, 5) !== "00" && v.slice(5) !== "0000",
  },
  GB: { type: "NINO", label: "National Insurance number", hint: "e.g. AB 12 34 56 C", required: true, pattern: /^(?!BG|GB|NK|KN|TN|NT|ZZ)[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\d{6}[A-D]$/ },
  CA: { type: "SIN", label: "Social Insurance Number (SIN)", hint: "9 digits", required: true, pattern: /^\d{9}$/, inputMode: "numeric", check: luhn },
  IN: { type: "PAN", label: "Permanent Account Number (PAN)", hint: "10 characters, e.g. ABCDE1234F", required: true, pattern: /^[A-Z]{5}\d{4}[A-Z]$/ },
  GH: { type: "GHANA_CARD", label: "Ghana Card number", hint: "e.g. GHA-123456789-0", required: true, pattern: /^GHA\d{10}$/ },
  KE: { type: "KE_ID", label: "National ID number", hint: "7 or 8 digits", required: true, pattern: /^\d{7,8}$/, inputMode: "numeric" },
  ZA: { type: "ZA_ID", label: "South African ID number", hint: "13 digits", required: true, pattern: /^\d{13}$/, inputMode: "numeric", check: luhn },
};

const GENERIC: NationalIdSpec = {
  type: "NATIONAL_ID",
  label: "National ID or passport number",
  hint: "The number on your government-issued ID",
  required: false,
  pattern: /^[A-Z0-9]{4,20}$/,
};

/** Human label for a stored type code (e.g. "SSN"). */
export function nationalIdLabel(type: string): string {
  return Object.values(SPECS).find((s) => s.type === type)?.label ?? GENERIC.label;
}

export function nationalIdSpec(country: string | null | undefined): NationalIdSpec {
  return (country && SPECS[country.toUpperCase()]) || GENERIC;
}

export function normalizeNationalId(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export type NationalIdCheck = { ok: true; value: string | null } | { ok: false; error: string };

export function checkNationalId(country: string, raw: string | null | undefined): NationalIdCheck {
  const spec = nationalIdSpec(country);
  const value = normalizeNationalId(raw ?? "");
  if (!value) return spec.required ? { ok: false, error: `${spec.label} is required` } : { ok: true, value: null };
  if (!spec.pattern.test(value) || (spec.check && !spec.check(value))) return { ok: false, error: `Enter a valid ${spec.label}` };
  return { ok: true, value };
}

export function maskNationalId(value: string): string {
  return `••••${value.slice(-4)}`;
}
