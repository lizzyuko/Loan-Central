import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { documentTypes, loanProducts } from "@/db/schema";
import { logger } from "@/lib/security/logger";

export type PublicLoanProduct = Pick<
  typeof loanProducts.$inferSelect,
  | "id"
  | "slug"
  | "name"
  | "shortDescription"
  | "description"
  | "purposeKey"
  | "minAmount"
  | "maxAmount"
  | "baseCurrency"
  | "supportedCurrencies"
  | "supportedCountries"
  | "termOptionsMonths"
  | "requiredDocumentTypes"
>;

const publicColumns = {
  id: loanProducts.id,
  slug: loanProducts.slug,
  name: loanProducts.name,
  shortDescription: loanProducts.shortDescription,
  description: loanProducts.description,
  purposeKey: loanProducts.purposeKey,
  minAmount: loanProducts.minAmount,
  maxAmount: loanProducts.maxAmount,
  baseCurrency: loanProducts.baseCurrency,
  supportedCurrencies: loanProducts.supportedCurrencies,
  supportedCountries: loanProducts.supportedCountries,
  termOptionsMonths: loanProducts.termOptionsMonths,
  requiredDocumentTypes: loanProducts.requiredDocumentTypes,
};

/** Active products for public pages. Returns [] (and logs) if the DB is unavailable. */
export async function getActiveProducts(): Promise<PublicLoanProduct[]> {
  try {
    return await getDb()
      .select(publicColumns)
      .from(loanProducts)
      .where(eq(loanProducts.isActive, true))
      .orderBy(asc(loanProducts.sortOrder), asc(loanProducts.name));
  } catch (err) {
    logger.error("Failed to load loan products", { err });
    return [];
  }
}

export type PublicDocumentType = Pick<typeof documentTypes.$inferSelect, "key" | "label" | "description">;

export async function getActiveDocumentTypes(): Promise<PublicDocumentType[]> {
  try {
    return await getDb()
      .select({ key: documentTypes.key, label: documentTypes.label, description: documentTypes.description })
      .from(documentTypes)
      .where(eq(documentTypes.isActive, true))
      .orderBy(asc(documentTypes.sortOrder));
  } catch (err) {
    logger.error("Failed to load document types", { err });
    return [];
  }
}
