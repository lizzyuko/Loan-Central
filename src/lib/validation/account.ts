import { z } from "zod";
import { BANK_SCHEMES, normalizeBankValue, type BankFieldKey } from "@/config/banking";
import { getCountry } from "@/config/countries";
import { countryCode, currencyCode, requiredText } from "./fields";

/**
 * Account details are validated against the banking scheme configured for the
 * chosen country (IBAN, routing number, sort code, ...). Unknown identifier
 * keys are rejected.
 */
export const accountDetailsSchema = z
  .object({
    applicationId: z.uuid(),
    accountHolderName: requiredText("Account holder name", 140),
    bankName: requiredText("Bank or financial institution", 140),
    country: countryCode("Bank country"),
    currency: currencyCode,
    identifiers: z.record(z.string(), z.string().max(64)),
    confirm: z.literal(true, { error: "Please confirm the details belong to you" }),
  })
  .transform((v, ctx) => {
    const scheme = getCountry(v.country)?.bankScheme ?? "GENERIC";
    const fields = BANK_SCHEMES[scheme];
    const allowed = new Set<string>(fields.map((f) => f.key));
    const out: Partial<Record<BankFieldKey, string>> = {};

    for (const key of Object.keys(v.identifiers)) {
      if (!allowed.has(key)) ctx.addIssue({ code: "custom", path: ["identifiers", key], message: "Unexpected field" });
    }
    for (const f of fields) {
      const raw = normalizeBankValue(v.identifiers[f.key] ?? "");
      if (!raw) {
        if (f.required) ctx.addIssue({ code: "custom", path: ["identifiers", f.key], message: `${f.label} is required` });
        continue;
      }
      if (!new RegExp(f.pattern).test(raw)) {
        ctx.addIssue({ code: "custom", path: ["identifiers", f.key], message: `Enter a valid ${f.label}` });
        continue;
      }
      out[f.key] = raw;
    }
    if (out.iban && !isValidIbanChecksum(out.iban)) {
      ctx.addIssue({ code: "custom", path: ["identifiers", "iban"], message: "This IBAN doesn't look right. Please check it." });
    }
    return { ...v, scheme, identifiers: out };
  });

export type AccountDetailsInput = z.input<typeof accountDetailsSchema>;
export type AccountDetailsParsed = z.output<typeof accountDetailsSchema>;

/** ISO 13616 mod-97 check. */
export function isValidIbanChecksum(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const digits = code >= 65 && code <= 90 ? String(code - 55) : ch;
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}
