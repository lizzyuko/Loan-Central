/**
 * Seed script.
 *
 *   npm run db:seed            reference data only (safe in any environment):
 *                              document types, loan products, advisory
 *                              eligibility rules, and the first SUPER_ADMIN from
 *                              SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (optional
 *                              SEED_ADMIN_NAME). An existing password is never
 *                              overwritten.
 *   npm run db:seed -- --dev   ALSO creates development sample data
 *                              (two demo admins + example applications).
 *                              Refused when NODE_ENV=production.
 *
 * Idempotent: safe to run repeatedly.
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { DEFAULT_DOCUMENT_TYPES } from "../src/config/documents";
import { toMonthlyIncome } from "../src/lib/application/income";
import { generateReference } from "../src/lib/application/reference";
import { hashPassword, newPasswordSchema } from "../src/lib/auth/password";
import type { ApplicationStatus, EmploymentStatus, IncomeFrequency } from "../src/db/schema/enums";

config({ path: ".env.local" });
config();

const DEV = process.argv.includes("--dev");
const DEV_PASSWORD = "loan-central-dev-only";

type Db = ReturnType<typeof drizzle<typeof schema>>;

/** Creates (or activates) the first super admin from SEED_ADMIN_* variables. */
async function seedSuperAdmin(db: Db): Promise<string> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (!email) return "skipped (SEED_ADMIN_EMAIL not set)";
  const policy = newPasswordSchema.safeParse(password);
  if (!policy.success) {
    // Warn instead of failing the deploy.
    console.warn(`SEED_ADMIN_PASSWORD rejected: ${policy.error.issues[0]?.message}. Seed admin not created.`);
    return "skipped (password does not meet policy)";
  }
  const name = process.env.SEED_ADMIN_NAME?.trim() || email.split("@")[0] || "Administrator";
  const [existing] = await db.select({ id: schema.admins.id, passwordHash: schema.admins.passwordHash }).from(schema.admins).where(eq(schema.admins.email, email));
  if (existing?.passwordHash) return `${email} (already set up, password unchanged)`;
  const passwordHash = await hashPassword(password);
  if (existing) {
    await db.update(schema.admins).set({ passwordHash, passwordUpdatedAt: new Date(), isActive: true }).where(eq(schema.admins.id, existing.id));
    return `${email} (password set)`;
  }
  await db.insert(schema.admins).values({ email, name, role: "SUPER_ADMIN", passwordHash, passwordUpdatedAt: new Date() });
  return `${email} (created)`;
}

const PRODUCTS = [
  {
    slug: "personal-loan",
    name: "Personal Loans",
    shortDescription: "Flexible borrowing for life's planned and unplanned expenses.",
    description: "For consolidating debt, home projects, medical costs or other personal needs.",
    purposeKey: "personal",
    minAmount: "1000",
    maxAmount: "50000",
    termOptionsMonths: [6, 12, 24, 36, 48, 60],
    requiredDocumentTypes: ["government_id", "proof_of_income"],
    sortOrder: 1,
  },
  {
    slug: "business-loan",
    name: "Business Loans",
    shortDescription: "Working capital and growth funding for small businesses.",
    description: "For inventory, equipment, expansion or managing cash flow.",
    purposeKey: "business",
    minAmount: "5000",
    maxAmount: "250000",
    termOptionsMonths: [12, 24, 36, 48, 60],
    requiredDocumentTypes: ["government_id", "proof_of_income", "employment_document"],
    sortOrder: 2,
  },
  {
    slug: "education-loan",
    name: "Education Loans",
    shortDescription: "Support for tuition, courses and study costs.",
    description: "For tuition fees, professional qualifications and related living costs.",
    purposeKey: "education",
    minAmount: "1000",
    maxAmount: "80000",
    termOptionsMonths: [12, 24, 36, 60, 84, 120],
    requiredDocumentTypes: ["government_id", "proof_of_address"],
    sortOrder: 3,
  },
  {
    slug: "auto-loan",
    name: "Auto Loans",
    shortDescription: "Finance a new or used vehicle.",
    description: "For purchasing a car, motorbike or commercial vehicle.",
    purposeKey: "auto",
    minAmount: "3000",
    maxAmount: "100000",
    termOptionsMonths: [12, 24, 36, 48, 60, 72],
    requiredDocumentTypes: ["government_id", "proof_of_income"],
    sortOrder: 4,
  },
];

const RULES = [
  { ruleType: "MIN_AGE", config: { minAge: 18 }, description: "Applicant should be at least 18." },
  { ruleType: "MAX_DTI", config: { maxRatio: 0.45 }, description: "Monthly debt repayments above 45% of monthly income warrant closer review." },
  { ruleType: "REQUIRED_DOCUMENTS", config: {}, description: "All product-required documents should be present." },
];

interface SampleApp {
  first: string;
  last: string;
  email: string;
  dob: string;
  phone: string;
  country: string;
  city: string;
  region: string | null;
  line1: string;
  postal: string | null;
  product: string;
  purpose: string;
  amount: string;
  currency: string;
  term: number;
  employment: EmploymentStatus;
  employer: string | null;
  job: string | null;
  income: string;
  frequency: IncomeFrequency;
  debt: string;
  expenses: string;
  status: ApplicationStatus;
  daysAgo: number;
}

// Fictional people for development only.
const SAMPLES: SampleApp[] = [
  { first: "Amara", last: "Okafor", email: "amara.okafor@example.com", dob: "1990-04-12", phone: "+2348031234567", country: "NG", city: "Lagos", region: "Lagos", line1: "14 Admiralty Way, Lekki", postal: null, product: "business-loan", purpose: "business", amount: "4500000", currency: "NGN", term: 24, employment: "BUSINESS_OWNER", employer: "Okafor Textiles Ltd", job: "Fabric wholesale", income: "1850000", frequency: "MONTHLY", debt: "220000", expenses: "640000", status: "SUBMITTED", daysAgo: 0 },
  { first: "Lukas", last: "Brandt", email: "lukas.brandt@example.com", dob: "1986-09-03", phone: "+4915112345678", country: "DE", city: "Hamburg", region: null, line1: "Schanzenstraße 41", postal: "20357", product: "auto-loan", purpose: "auto", amount: "18500", currency: "EUR", term: 48, employment: "EMPLOYED_FULL_TIME", employer: "Hafen Logistik GmbH", job: "Operations planner", income: "58200", frequency: "ANNUALLY", debt: "310", expenses: "1650", status: "UNDER_REVIEW", daysAgo: 2 },
  { first: "Priya", last: "Raman", email: "priya.raman@example.com", dob: "1998-01-27", phone: "+919845012345", country: "IN", city: "Bengaluru", region: "Karnataka", line1: "22 3rd Cross, Indiranagar", postal: "560038", product: "education-loan", purpose: "education", amount: "950000", currency: "INR", term: 60, employment: "EMPLOYED_PART_TIME", employer: "Northbridge Analytics", job: "Research assistant", income: "42000", frequency: "MONTHLY", debt: "0", expenses: "21000", status: "MORE_INFORMATION_REQUIRED", daysAgo: 5 },
  { first: "Daniel", last: "Mensah", email: "daniel.mensah@example.com", dob: "1983-06-18", phone: "+233244123456", country: "GH", city: "Accra", region: "Greater Accra", line1: "7 Oxford Street, Osu", postal: null, product: "personal-loan", purpose: "home_improvement", amount: "60000", currency: "GHS", term: 36, employment: "EMPLOYED_FULL_TIME", employer: "Coastal Power Services", job: "Electrical engineer", income: "11500", frequency: "MONTHLY", debt: "1400", expenses: "4200", status: "ELIGIBLE", daysAgo: 9 },
  { first: "Sophie", last: "Tremblay", email: "sophie.tremblay@example.com", dob: "1992-11-30", phone: "+15145550147", country: "CA", city: "Montréal", region: "QC", line1: "4820 Rue Saint-Denis", postal: "H2J 2L6", product: "personal-loan", purpose: "debt_consolidation", amount: "22000", currency: "CAD", term: 48, employment: "SELF_EMPLOYED", employer: "Tremblay Design Studio", job: "Interior design", income: "2950", frequency: "BIWEEKLY", debt: "980", expenses: "2400", status: "ACCOUNT_DETAILS_REQUESTED", daysAgo: 14 },
  { first: "James", last: "Whitfield", email: "james.whitfield@example.com", dob: "1979-02-08", phone: "+447700900321", country: "GB", city: "Leeds", region: "West Yorkshire", line1: "18 Park Square East", postal: "LS1 2NE", product: "business-loan", purpose: "business", amount: "75000", currency: "GBP", term: 60, employment: "BUSINESS_OWNER", employer: "Whitfield Joinery Ltd", job: "Bespoke furniture", income: "96000", frequency: "ANNUALLY", debt: "1200", expenses: "2900", status: "FINAL_REVIEW", daysAgo: 21 },
  { first: "Wanjiru", last: "Kamau", email: "wanjiru.kamau@example.com", dob: "1995-07-21", phone: "+254712345678", country: "KE", city: "Nairobi", region: "Nairobi County", line1: "Riverside Drive, Block C4", postal: "00100", product: "personal-loan", purpose: "medical", amount: "350000", currency: "KES", term: 24, employment: "EMPLOYED_FULL_TIME", employer: "Savanna Health Partners", job: "Pharmacist", income: "185000", frequency: "MONTHLY", debt: "95000", expenses: "70000", status: "NOT_ELIGIBLE", daysAgo: 12 },
  { first: "Mateo", last: "Fernández", email: "mateo.fernandez@example.com", dob: "1988-03-14", phone: "+5491123456789", country: "AR", city: "Buenos Aires", region: "CABA", line1: "Av. Corrientes 3247", postal: "C1193", product: "auto-loan", purpose: "auto", amount: "14000", currency: "USD", term: 36, employment: "CONTRACTOR", employer: "Freelance", job: "Software developer", income: "4100", frequency: "MONTHLY", debt: "250", expenses: "1700", status: "COMPLETED", daysAgo: 34 },
];

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  if (DEV && process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed development sample data with NODE_ENV=production.");
  }

  const client = postgres(url, { max: 1, prepare: false });
  const db = drizzle(client, { schema, casing: "snake_case" });

  try {
    // Reference data -----------------------------------------------------------
    for (const [i, t] of DEFAULT_DOCUMENT_TYPES.entries()) {
      await db
        .insert(schema.documentTypes)
        .values({ key: t.key, label: t.label, description: t.description, sortOrder: i })
        .onConflictDoNothing();
    }
    for (const p of PRODUCTS) {
      await db.insert(schema.loanProducts).values({ ...p, baseCurrency: "USD" }).onConflictDoNothing();
    }
    const existingRules = await db.select({ id: schema.eligibilityRules.id }).from(schema.eligibilityRules).limit(1);
    if (existingRules.length === 0) await db.insert(schema.eligibilityRules).values(RULES);

    const seedAdmin = await seedSuperAdmin(db);
    console.log(`Reference data ready (${PRODUCTS.length} products, ${DEFAULT_DOCUMENT_TYPES.length} document types). Seed admin: ${seedAdmin}.`);

    if (!DEV) return;

    // Development sample data -------------------------------------------------
    // Development-only credentials (this branch is refused in production).
    const devHash = await hashPassword(DEV_PASSWORD);
    await db
      .insert(schema.admins)
      .values([
        { email: "super.admin@loancentral.test", name: "Morgan Ellis", role: "SUPER_ADMIN", passwordHash: devHash, passwordUpdatedAt: new Date() },
        { email: "reviewer@loancentral.test", name: "Ife Adeyemi", role: "ADMIN", passwordHash: devHash, passwordUpdatedAt: new Date() },
      ])
      .onConflictDoNothing();

    const products = await db.select({ id: schema.loanProducts.id, slug: schema.loanProducts.slug }).from(schema.loanProducts);
    let created = 0;
    for (const s of SAMPLES) {
      const exists = await db.select({ id: schema.applicants.id }).from(schema.applicants).where(eq(schema.applicants.email, s.email)).limit(1);
      if (exists.length > 0) continue;
      const at = new Date(Date.now() - s.daysAgo * 86_400_000);

      await db.transaction(async (tx) => {
        const [applicant] = await tx
          .insert(schema.applicants)
          .values({ email: s.email, firstName: s.first, lastName: s.last, dateOfBirth: s.dob, phone: s.phone, countryOfResidence: s.country, nationality: s.country })
          .returning({ id: schema.applicants.id });
        const [app] = await tx
          .insert(schema.applications)
          .values({
            reference: generateReference(at),
            applicantId: applicant!.id,
            loanProductId: products.find((p) => p.slug === s.product)?.id ?? null,
            status: s.status,
            country: s.country,
            idempotencyKey: crypto.randomUUID(),
            submittedAt: at,
            statusChangedAt: at,
            createdAt: at,
          })
          .returning({ id: schema.applications.id });
        const applicationId = app!.id;
        await tx.insert(schema.loanRequests).values({ applicationId, purpose: s.purpose, amount: s.amount, currency: s.currency, termMonths: s.term, repaymentFrequency: "MONTHLY" });
        await tx.insert(schema.addresses).values({ applicationId, country: s.country, region: s.region, city: s.city, line1: s.line1, postalCode: s.postal });
        await tx.insert(schema.employmentProfiles).values({
          applicationId,
          employmentStatus: s.employment,
          employerName: s.employer,
          jobTitle: s.job,
          incomeAmount: s.income,
          incomeCurrency: s.currency,
          incomeFrequency: s.frequency,
          monthlyIncome: toMonthlyIncome(s.income, s.frequency),
          monthsInRole: 18 + created * 7,
        });
        await tx.insert(schema.financialProfiles).values({
          applicationId,
          currency: s.currency,
          hasExistingLoans: Number(s.debt) > 0,
          existingLoanCount: Number(s.debt) > 0 ? 1 : null,
          monthlyDebtPayments: s.debt,
          monthlyExpenses: s.expenses,
        });
        await tx.insert(schema.applicationEvents).values({ applicationId, type: "application.submitted", summary: "Application submitted (sample data)", actorType: "APPLICANT", createdAt: at });
      });
      created++;
    }
    console.log(`Development data ready (${created} new sample applications, demo admins super.admin@loancentral.test / reviewer@loancentral.test, password "${DEV_PASSWORD}").`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
