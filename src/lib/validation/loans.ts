import { z } from "zod";
import { REPAYMENT_FREQUENCIES } from "@/db/schema/enums";
import { cleanText, currencyCode, isoDate, moneyAmount } from "./fields";

export const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
] as const;
const methodValues = PAYMENT_METHODS.map((m) => m.value) as [string, ...string[]];

const optionalNote = (max: number) =>
  z
    .string()
    .transform(cleanText)
    .pipe(z.string().max(max))
    .optional()
    .transform((v) => v || undefined);

export const approveLoanSchema = z.object({
  applicationId: z.uuid(),
  principal: moneyAmount("Approved amount", { min: 1, max: 100_000_000 }),
  currency: currencyCode,
  annualRatePct: z.coerce.number({ error: "Enter the interest rate" }).min(0, { error: "Rate can't be negative" }).max(1000),
  termMonths: z.coerce.number().int().min(1, { error: "Term must be at least 1 month" }).max(360),
  frequency: z.enum(REPAYMENT_FREQUENCIES),
  firstDueDate: isoDate,
  message: optionalNote(2000),
  notify: z.boolean().default(true),
});

export const disburseSchema = z.object({ loanId: z.uuid(), disbursedOn: isoDate });

export const recordPaymentSchema = z.object({
  loanId: z.uuid(),
  amount: moneyAmount("Amount", { min: 0.01 }),
  paidOn: isoDate,
  method: z.enum(methodValues, { error: "Choose a payment method" }),
  reference: optionalNote(120),
  note: optionalNote(500),
  notify: z.boolean().default(true),
});

export const voidPaymentSchema = z.object({
  paymentId: z.uuid(),
  reason: z.string().transform(cleanText).pipe(z.string().min(3, { error: "Give a short reason" }).max(300)),
});

export const loanSettingsSchema = z.object({
  repaymentInstructions: z.string().transform(cleanText).pipe(z.string().max(2000)),
});
