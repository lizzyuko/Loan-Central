import { z } from "zod";
import { ADMIN_ROLES } from "@/db/schema/enums";
import { isSupportedCurrency } from "@/config/currencies";
import { isValidCountry } from "@/config/countries";
import { LOAN_PURPOSE_VALUES } from "@/config/site";
import { email, moneyAmount, requiredText } from "./fields";

const csvList = (validate: (v: string) => boolean, label: string) =>
  z
    .string()
    .transform((s) =>
      s
        .split(",")
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean),
    )
    .refine((arr) => arr.every(validate), { error: `Contains an invalid ${label}` });

export const adminCreateSchema = z.object({
  email,
  name: requiredText("Name", 80),
  role: z.enum(ADMIN_ROLES),
});

export const adminIdSchema = z.object({ adminId: z.uuid() });

export const adminUpdateSchema = z.object({
  adminId: z.uuid(),
  role: z.enum(ADMIN_ROLES),
  isActive: z.boolean(),
});

export const productSchema = z
  .object({
    id: z.uuid().optional(),
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,60}$/, { error: "Use 3-60 lowercase letters, numbers or hyphens" }),
    name: requiredText("Name", 80),
    shortDescription: requiredText("Short description", 160),
    description: requiredText("Description", 1000),
    purposeKey: z.enum(LOAN_PURPOSE_VALUES),
    minAmount: moneyAmount("Minimum amount", { min: 1 }),
    maxAmount: moneyAmount("Maximum amount", { min: 1 }),
    baseCurrency: z.string().trim().toUpperCase().refine(isSupportedCurrency, { error: "Invalid currency" }),
    supportedCurrencies: csvList(isSupportedCurrency, "currency"),
    supportedCountries: csvList(isValidCountry, "country code"),
    termOptionsMonths: z
      .string()
      .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean).map(Number))
      .refine((arr) => arr.length > 0 && arr.every((n) => Number.isInteger(n) && n > 0 && n <= 360), { error: "Enter terms in months, e.g. 12, 24, 36" }),
    requiredDocumentTypes: z.array(z.string().regex(/^[a-z][a-z0-9_]{1,40}$/)).max(10),
    isActive: z.boolean(),
    sortOrder: z.coerce.number().int().min(0).max(999),
  })
  .refine((v) => Number(v.minAmount) <= Number(v.maxAmount), { path: ["maxAmount"], error: "Maximum must be at least the minimum" });

export const documentTypeSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,40}$/, { error: "Use lowercase letters, numbers and underscores" }),
  label: requiredText("Label", 80),
  description: requiredText("Description", 300),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(999),
});
