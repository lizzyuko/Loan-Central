import { getCountryCallingCode, type CountryCode } from "libphonenumber-js/min";

/**
 * Country configuration. Every ISO-3166-1 alpha-2 country is available;
 * per-country overrides describe address format, default currency and the
 * banking identifiers used locally. Countries without overrides get sensible
 * generic defaults — nothing assumes a single country.
 */

// prettier-ignore
const ISO_COUNTRIES = (
  "AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ " +
  "NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ " +
  "UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW"
).split(" ");

export type BankScheme =
  | "IBAN"
  | "US_ROUTING"
  | "UK_SORT_CODE"
  | "CA_TRANSIT"
  | "AU_BSB"
  | "IN_IFSC"
  | "GENERIC";

export interface AddressFormat {
  regionLabel: string;
  regionRequired: boolean;
  postalLabel: string;
  postalRequired: boolean;
  /** Optional validation pattern for the postal code. */
  postalPattern?: string;
}

export interface CountryConfig {
  code: string;
  name: string;
  dialCode: string | null;
  defaultCurrency: string | null;
  address: AddressFormat;
  bankScheme: BankScheme;
}

const DEFAULT_ADDRESS: AddressFormat = {
  regionLabel: "State / province / region",
  regionRequired: false,
  postalLabel: "Postal code",
  postalRequired: false,
};

const ADDRESS_OVERRIDES: Record<string, Partial<AddressFormat>> = {
  US: { regionLabel: "State", regionRequired: true, postalLabel: "ZIP code", postalRequired: true, postalPattern: "^\\d{5}(-\\d{4})?$" },
  CA: { regionLabel: "Province / territory", regionRequired: true, postalRequired: true, postalPattern: "^[A-Za-z]\\d[A-Za-z][ -]?\\d[A-Za-z]\\d$" },
  GB: { regionLabel: "County", postalLabel: "Postcode", postalRequired: true },
  AU: { regionLabel: "State / territory", regionRequired: true, postalLabel: "Postcode", postalRequired: true, postalPattern: "^\\d{4}$" },
  IN: { regionLabel: "State", regionRequired: true, postalLabel: "PIN code", postalRequired: true, postalPattern: "^\\d{6}$" },
  DE: { postalRequired: true, postalPattern: "^\\d{5}$" },
  FR: { postalRequired: true, postalPattern: "^\\d{5}$" },
  NG: { regionLabel: "State", regionRequired: true },
  GH: { regionLabel: "Region", regionRequired: true },
  KE: { regionLabel: "County", regionRequired: true },
  ZA: { regionLabel: "Province", regionRequired: true, postalRequired: true, postalPattern: "^\\d{4}$" },
  BR: { regionLabel: "State", regionRequired: true, postalLabel: "CEP", postalRequired: true },
  MX: { regionLabel: "State", regionRequired: true, postalRequired: true },
  IE: { regionLabel: "County", postalLabel: "Eircode" },
  AE: { regionLabel: "Emirate", regionRequired: true },
  PH: { regionLabel: "Province", regionRequired: true },
  JP: { regionLabel: "Prefecture", regionRequired: true, postalRequired: true },
  CN: { regionLabel: "Province", regionRequired: true, postalRequired: true },
};

// prettier-ignore
const IBAN_COUNTRIES = new Set((
  "AD AE AL AT AZ BA BE BG BH BR BY CH CR CY CZ DE DK DO EE EG ES FI FO FR GE GI GL GR GT HR HU IE IL IQ IS IT " +
  "JO KW KZ LB LC LI LT LU LV LY MC MD ME MK MR MT MU NL NO PK PL PS PT QA RO RS SA SC SE SI SK SM ST SV TL TN TR UA VA VG XK"
).split(" "));

const BANK_OVERRIDES: Record<string, BankScheme> = {
  US: "US_ROUTING",
  GB: "UK_SORT_CODE",
  CA: "CA_TRANSIT",
  AU: "AU_BSB",
  IN: "IN_IFSC",
};

// prettier-ignore
const EURO = "AD AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MC ME MT NL PT SI SK SM VA XK".split(" ");

// prettier-ignore
const DEFAULT_CURRENCY: Record<string, string> = {
  ...Object.fromEntries(EURO.map((c) => [c, "EUR"])),
  US: "USD", PR: "USD", EC: "USD", SV: "USD", PA: "USD", GB: "GBP", CA: "CAD", AU: "AUD", NZ: "NZD",
  CH: "CHF", LI: "CHF", JP: "JPY", CN: "CNY", HK: "HKD", SG: "SGD", IN: "INR", PK: "PKR", BD: "BDT",
  LK: "LKR", NP: "NPR", PH: "PHP", ID: "IDR", MY: "MYR", TH: "THB", VN: "VND", KR: "KRW", TW: "TWD",
  AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", BH: "BHD", OM: "OMR", JO: "JOD", IL: "ILS", TR: "TRY",
  EG: "EGP", MA: "MAD", TN: "TND", NG: "NGN", GH: "GHS", KE: "KES", UG: "UGX", TZ: "TZS", RW: "RWF",
  ZA: "ZAR", BW: "BWP", NA: "NAD", ZM: "ZMW", MW: "MWK", ET: "ETB", MU: "MUR",
  SN: "XOF", CI: "XOF", BJ: "XOF", BF: "XOF", ML: "XOF", NE: "XOF", TG: "XOF", GW: "XOF",
  CM: "XAF", GA: "XAF", CG: "XAF", TD: "XAF", CF: "XAF", GQ: "XAF",
  SE: "SEK", NO: "NOK", DK: "DKK", IS: "ISK", PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", BG: "BGN",
  RS: "RSD", UA: "UAH", GE: "GEL", BR: "BRL", MX: "MXN", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN",
  UY: "UYU", DO: "DOP", JM: "JMD", TT: "TTD",
};

function displayName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function dialCode(code: string): string | null {
  try {
    return `+${getCountryCallingCode(code as CountryCode)}`;
  } catch {
    return null;
  }
}

const cache = new Map<string, CountryConfig>();

export function getCountry(code: string, locale = "en"): CountryConfig | null {
  const upper = code.toUpperCase();
  if (!ISO_COUNTRIES.includes(upper)) return null;
  const key = `${locale}:${upper}`;
  let cfg = cache.get(key);
  if (!cfg) {
    cfg = {
      code: upper,
      name: displayName(upper, locale),
      dialCode: dialCode(upper),
      defaultCurrency: DEFAULT_CURRENCY[upper] ?? null,
      address: { ...DEFAULT_ADDRESS, ...ADDRESS_OVERRIDES[upper] },
      bankScheme: BANK_OVERRIDES[upper] ?? (IBAN_COUNTRIES.has(upper) ? "IBAN" : "GENERIC"),
    };
    cache.set(key, cfg);
  }
  return cfg;
}

export function isValidCountry(code: string): boolean {
  return ISO_COUNTRIES.includes(code.toUpperCase());
}

export function countryName(code: string | null | undefined, locale = "en"): string {
  if (!code) return "-";
  return getCountry(code, locale)?.name ?? code;
}

let optionsCache: { value: string; label: string }[] | null = null;

export function countryOptions(locale = "en") {
  if (locale === "en" && optionsCache) return optionsCache;
  const options = ISO_COUNTRIES.map((code) => ({ value: code, label: displayName(code, locale) })).sort(
    (a, b) => a.label.localeCompare(b.label, locale),
  );
  if (locale === "en") optionsCache = options;
  return options;
}

export const ALL_COUNTRY_CODES: readonly string[] = ISO_COUNTRIES;
