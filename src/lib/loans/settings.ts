import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { systemSettings } from "@/db/schema";

/** Loan servicing settings (Settings → Loans). */
const KEY = "loans";

export interface LoanSettings {
  /** How applicants should pay (bank details, mobile money number, reference to use). */
  repaymentInstructions: string;
}

export async function getLoanSettings(): Promise<LoanSettings> {
  const [row] = await getDb().select().from(systemSettings).where(eq(systemSettings.key, KEY)).limit(1);
  const v = (row?.value ?? {}) as Partial<LoanSettings>;
  return { repaymentInstructions: typeof v.repaymentInstructions === "string" ? v.repaymentInstructions : "" };
}

export async function saveLoanSettings(settings: LoanSettings, adminId: string): Promise<void> {
  const value = { repaymentInstructions: settings.repaymentInstructions };
  await getDb()
    .insert(systemSettings)
    .values({ key: KEY, value, updatedByAdminId: adminId })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedByAdminId: adminId, updatedAt: new Date() } });
}
