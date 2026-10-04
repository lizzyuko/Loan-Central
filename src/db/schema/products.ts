import { boolean, integer, jsonb, pgTable, text, uniqueIndex, uuid, index } from "drizzle-orm/pg-core";
import { createdAt, id, money, updatedAt } from "./columns";

export const loanProducts = pgTable(
  "loan_products",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    shortDescription: text("short_description").notNull(),
    description: text("description").notNull(),
    /** Purpose value pre-selected in the wizard when this product is chosen. */
    purposeKey: text("purpose_key").notNull(),
    /** Limits are expressed in `baseCurrency`; informational, not enforced FX. */
    minAmount: money("min_amount").notNull(),
    maxAmount: money("max_amount").notNull(),
    baseCurrency: text("base_currency").notNull().default("USD"),
    /** Empty array = all currencies accepted. */
    supportedCurrencies: text("supported_currencies").array().notNull().default([]),
    /** Empty array = all countries accepted. */
    supportedCountries: text("supported_countries").array().notNull().default([]),
    termOptionsMonths: integer("term_options_months").array().notNull().default([]),
    /** Keys from document_types. */
    requiredDocumentTypes: text("required_document_types").array().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("loan_products_slug_idx").on(t.slug)],
);

export const documentTypes = pgTable("document_types", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  description: text("description").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * Configurable, ADVISORY eligibility rules. They produce indicators for
 * reviewers; they never make a decision on their own.
 */
export const eligibilityRules = pgTable(
  "eligibility_rules",
  {
    id: id(),
    /** Null = applies to every product. */
    loanProductId: uuid("loan_product_id").references(() => loanProducts.id, {
      onDelete: "cascade",
    }),
    /** MIN_AGE | MAX_DTI | MIN_MONTHLY_INCOME | COUNTRY_ALLOWED | EMPLOYMENT_STATUS | REQUIRED_DOCUMENTS */
    ruleType: text("rule_type").notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    description: text("description").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("eligibility_rules_product_idx").on(t.loanProductId)],
);
