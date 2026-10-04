import type { IncomeFrequency } from "@/db/schema/enums";

/** Payment periods per year for each frequency. */
const PERIODS_PER_YEAR: Record<IncomeFrequency, number> = {
  WEEKLY: 52,
  BIWEEKLY: 26,
  MONTHLY: 12,
  ANNUALLY: 1,
};

/**
 * Normalise an income figure to a monthly amount, rounded to 2dp.
 * Works in integer cents to avoid float drift.
 */
export function toMonthlyIncome(amount: string | number, frequency: IncomeFrequency): string {
  const cents = Math.round(Number(amount) * 100);
  const monthlyCents = Math.round((cents * PERIODS_PER_YEAR[frequency]) / 12);
  return (monthlyCents / 100).toFixed(2);
}

/**
 * Debt-to-income ratio (0–1+) from monthly figures in the same currency.
 * Returns null when it can't be meaningfully computed.
 */
export function debtToIncome(monthlyDebt: string | number, monthlyIncome: string | number): number | null {
  const income = Number(monthlyIncome);
  const debt = Number(monthlyDebt);
  if (!Number.isFinite(income) || !Number.isFinite(debt) || income <= 0) return null;
  return debt / income;
}
