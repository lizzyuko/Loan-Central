/**
 * Currencies offered in forms. ISO-4217 codes; names come from Intl so they
 * localise automatically. Add or remove codes here — nothing else hard-codes
 * a currency.
 */
export const SUPPORTED_CURRENCIES = [
  "USD", "EUR", "GBP", "CAD", "AUD", "NZD", "CHF", "JPY", "CNY", "HKD",
  "SGD", "INR", "PKR", "BDT", "LKR", "NPR", "PHP", "IDR", "MYR", "THB",
  "VND", "KRW", "TWD", "AED", "SAR", "QAR", "KWD", "BHD", "OMR", "JOD",
  "ILS", "TRY", "EGP", "MAD", "TND", "NGN", "GHS", "KES", "UGX", "TZS",
  "RWF", "ZAR", "BWP", "NAD", "ZMW", "MWK", "ETB", "XOF", "XAF", "MUR",
  "SEK", "NOK", "DKK", "ISK", "PLN", "CZK", "HUF", "RON", "BGN", "RSD",
  "UAH", "GEL", "BRL", "MXN", "ARS", "CLP", "COP", "PEN", "UYU", "DOP",
  "JMD", "TTD",
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

const currencySet = new Set<string>(SUPPORTED_CURRENCIES);

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return currencySet.has(code);
}

const nameCache = new Map<string, string>();

export function currencyName(code: string, locale = "en"): string {
  const key = `${locale}:${code}`;
  let name = nameCache.get(key);
  if (!name) {
    try {
      name = new Intl.DisplayNames([locale], { type: "currency" }).of(code) ?? code;
    } catch {
      name = code;
    }
    nameCache.set(key, name);
  }
  return name;
}

export function currencyOptions(locale = "en") {
  return SUPPORTED_CURRENCIES.map((code) => ({
    value: code,
    label: `${code} (${currencyName(code, locale)})`,
  }));
}

/** Locale-aware money formatting. Accepts decimal strings from the DB. */
export function formatMoney(
  amount: string | number,
  currency: string,
  locale = "en",
  options: { compact?: boolean } = {},
): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return `${amount} ${currency}`;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: options.compact ? "compact" : "standard",
      maximumFractionDigits: options.compact ? 1 : 2,
    }).format(value);
  } catch {
    return `${value.toLocaleString(locale)} ${currency}`;
  }
}
