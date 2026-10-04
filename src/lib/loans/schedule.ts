import type { InstallmentStatus, RepaymentFrequency } from "@/db/schema/enums";

/**
 * Pure loan maths (no I/O): flat-rate schedules, payment allocation and
 * summaries. All arithmetic is done in integer minor units (cents).
 *
 * Flat rate: total interest = principal × annual rate × (term months / 12),
 * charged on the ORIGINAL principal and spread evenly across instalments.
 */

export const toCents = (v: string | number): number => Math.round(Number(v) * 100);
export const fromCents = (c: number): string => (c / 100).toFixed(2);

export function installmentCount(termMonths: number, frequency: RepaymentFrequency): number {
  if (frequency === "MONTHLY") return termMonths;
  const perYear = frequency === "WEEKLY" ? 52 : 26;
  return Math.max(1, Math.round((termMonths * perYear) / 12));
}

export function flatInterestCents(principalCents: number, annualRatePct: number, termMonths: number): number {
  return Math.round((principalCents * annualRatePct * termMonths) / (100 * 12));
}

// --- Dates (UTC, ISO yyyy-mm-dd) --------------------------------------------------

export function parseIsoDate(d: string): Date {
  return new Date(`${d}T00:00:00Z`);
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Due date of the n-th instalment (0-based), anchored to the first due date. */
export function dueDateFor(firstDueDate: string, frequency: RepaymentFrequency, n: number): string {
  const first = parseIsoDate(firstDueDate);
  if (frequency !== "MONTHLY") {
    const days = frequency === "WEEKLY" ? 7 : 14;
    return toIsoDate(new Date(first.getTime() + n * days * 86_400_000));
  }
  // Monthly: same day-of-month as the first due date, clamped to month end (Jan 31 → Feb 28 → Mar 31).
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth() + n;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return toIsoDate(new Date(Date.UTC(y, m, Math.min(first.getUTCDate(), lastDay))));
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseIsoDate(toIso).getTime() - parseIsoDate(fromIso).getTime()) / 86_400_000);
}

// --- Schedule ------------------------------------------------------------------------

export interface ScheduleInput {
  principal: string | number;
  annualRatePct: number;
  termMonths: number;
  frequency: RepaymentFrequency;
  firstDueDate: string;
}

export interface ScheduledInstallment {
  sequence: number;
  dueDate: string;
  principalDue: string;
  interestDue: string;
  amountDue: string;
}

export interface Schedule {
  installmentCount: number;
  totalInterest: string;
  totalRepayable: string;
  /** The regular instalment amount (the last one absorbs rounding). */
  regularInstallment: string;
  installments: ScheduledInstallment[];
}

/** Split `total` cents into `n` near-equal parts; the remainder goes on the last part. */
function split(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const parts = Array.from({ length: n }, () => base);
  parts[n - 1] = total - base * (n - 1);
  return parts;
}

export function buildFlatSchedule(input: ScheduleInput): Schedule {
  const principal = toCents(input.principal);
  if (principal <= 0) throw new Error("Principal must be positive");
  if (input.annualRatePct < 0 || input.annualRatePct > 1000) throw new Error("Invalid interest rate");
  if (!Number.isInteger(input.termMonths) || input.termMonths < 1 || input.termMonths > 360) throw new Error("Invalid term");

  const n = installmentCount(input.termMonths, input.frequency);
  const interest = flatInterestCents(principal, input.annualRatePct, input.termMonths);
  const principalParts = split(principal, n);
  const interestParts = split(interest, n);

  const installments = principalParts.map((p, i) => {
    const intr = interestParts[i] ?? 0;
    return {
      sequence: i + 1,
      dueDate: dueDateFor(input.firstDueDate, input.frequency, i),
      principalDue: fromCents(p),
      interestDue: fromCents(intr),
      amountDue: fromCents(p + intr),
    };
  });

  return {
    installmentCount: n,
    totalInterest: fromCents(interest),
    totalRepayable: fromCents(principal + interest),
    regularInstallment: installments[0]!.amountDue,
    installments,
  };
}

// --- Payment allocation ----------------------------------------------------------------

export interface AllocationResult {
  amountPaid: string;
  status: InstallmentStatus;
}

/**
 * Apply the total of all (non-voided) payments to instalments in order, oldest
 * first. Recomputing from scratch keeps the result correct after a payment is
 * voided. Returns null if payments exceed the total repayable.
 */
export function allocatePayments(amountsDue: string[], totalPaid: string | number): AllocationResult[] | null {
  let remaining = toCents(totalPaid);
  const due = amountsDue.map(toCents);
  if (remaining > due.reduce((a, b) => a + b, 0)) return null;
  return due.map((d) => {
    const paid = Math.min(d, Math.max(0, remaining));
    remaining -= paid;
    return { amountPaid: fromCents(paid), status: paid === 0 ? "PENDING" : paid >= d ? "PAID" : "PARTIAL" };
  });
}

// --- Summary ------------------------------------------------------------------------------

export interface InstallmentLike {
  dueDate: string;
  amountDue: string;
  amountPaid: string;
  status: InstallmentStatus;
}

export interface LoanSummary {
  totalDue: string;
  totalPaid: string;
  outstanding: string;
  overdueAmount: string;
  overdueCount: number;
  nextDue: { dueDate: string; amount: string; daysUntil: number } | null;
  paidCount: number;
}

export function summarizeLoan(installments: InstallmentLike[], todayIso: string): LoanSummary {
  let totalDue = 0;
  let totalPaid = 0;
  let overdue = 0;
  let overdueCount = 0;
  let paidCount = 0;
  let nextDue: LoanSummary["nextDue"] = null;
  for (const i of [...installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate))) {
    const due = toCents(i.amountDue);
    const paid = toCents(i.amountPaid);
    totalDue += due;
    totalPaid += paid;
    if (i.status === "PAID") {
      paidCount++;
      continue;
    }
    if (i.dueDate < todayIso) {
      overdue += due - paid;
      overdueCount++;
    } else if (!nextDue) {
      nextDue = { dueDate: i.dueDate, amount: fromCents(due - paid), daysUntil: daysBetween(todayIso, i.dueDate) };
    }
  }
  return {
    totalDue: fromCents(totalDue),
    totalPaid: fromCents(totalPaid),
    outstanding: fromCents(totalDue - totalPaid),
    overdueAmount: fromCents(overdue),
    overdueCount,
    nextDue,
    paidCount,
  };
}

/** Which reminder (if any) applies to an unpaid instalment today. */
export function reminderKindFor(dueDate: string, todayIso: string): "UPCOMING" | "DUE_TODAY" | "OVERDUE_1" | "OVERDUE_7" | null {
  const d = daysBetween(todayIso, dueDate); // positive = in the future
  if (d >= 1 && d <= 3) return "UPCOMING";
  if (d === 0) return "DUE_TODAY";
  if (d <= -7) return "OVERDUE_7";
  if (d <= -1) return "OVERDUE_1";
  return null;
}
