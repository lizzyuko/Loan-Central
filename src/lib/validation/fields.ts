import { z } from "zod";
import { isSupportedCurrency } from "@/config/currencies";
import { isValidCountry } from "@/config/countries";

// Strip ASCII control characters (except tab/newline) and trim.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanText(value: string): string {
  return value.replace(CONTROL_CHARS, "").trim();
}

export const requiredText = (label: string, max = 120) =>
  z
    .string({ error: `${label} is required` })
    .transform(cleanText)
    .pipe(
      z
        .string()
        .min(1, { error: `${label} is required` })
        .max(max, { error: `${label} must be ${max} characters or fewer` }),
    );

export const optionalText = (label: string, max = 120) =>
  z
    .string()
    .transform(cleanText)
    .pipe(z.string().max(max, { error: `${label} must be ${max} characters or fewer` }))
    .optional()
    .or(z.literal("").transform(() => undefined));

/** Person names: letters from any script, spaces, apostrophes, hyphens, periods. */
export const personName = (label: string) =>
  requiredText(label, 80).pipe(
    z.string().regex(/^[\p{L}\p{M}][\p{L}\p{M}\s'’.-]*$/u, { error: `Enter a valid ${label.toLowerCase()}` }),
  );

export const email = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address" }).max(254));

export const countryCode = (label = "Country") =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .toUpperCase()
    .refine(isValidCountry, { error: `Select a ${label.toLowerCase()}` });

export const currencyCode = z
  .string({ error: "Currency is required" })
  .trim()
  .toUpperCase()
  .refine(isSupportedCurrency, { error: "Select a currency" });

const MONEY_RE = /^\d{1,12}(\.\d{1,2})?$/;

/** Decimal money as a string (inputs are strings; DB stores numeric). */
export const moneyAmount = (label: string, { min = 0, max = 1_000_000_000 } = {}) =>
  z
    .string({ error: `${label} is required` })
    .transform((v) => v.replace(/[,\s]/g, ""))
    .pipe(
      z
        .string()
        .min(1, { error: `${label} is required` })
        .regex(MONEY_RE, { error: `Enter ${label.toLowerCase()} as a number` })
        .refine((v) => Number(v) >= min, { error: `${label} must be at least ${min.toLocaleString("en")}` })
        .refine((v) => Number(v) <= max, { error: `${label} must be ${max.toLocaleString("en")} or less` }),
    );

export const integerString = (label: string, { min = 0, max = 1000, optional = false } = {}) => {
  const base = z
    .string()
    .trim()
    .regex(/^\d+$/, { error: `Enter ${label.toLowerCase()} as a whole number` })
    .refine((v) => Number(v) >= min && Number(v) <= max, {
      error: `${label} must be between ${min} and ${max}`,
    });
  return optional ? base.optional().or(z.literal("").transform(() => undefined)) : base;
};

export const isoDate = z
  .string({ error: "Date is required" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Enter a valid date" })
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), { error: "Enter a valid date" });

export function ageOn(dob: string, now = new Date()): number {
  const d = new Date(`${dob}T00:00:00Z`);
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age;
}
