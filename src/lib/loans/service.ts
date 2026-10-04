import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import type { z } from "zod";
import { getDb, type Transaction } from "@/db";
import { admins, applicants, applications, loanInstallments, loanPayments, loanReminders, loans } from "@/db/schema";
import type { CommunicationType, ReminderKind } from "@/db/schema/enums";
import { formatMoney } from "@/config/currencies";
import { REPAYMENT_FREQUENCY_LABELS } from "@/config/site";
import { assertTransition, InvalidTransitionError } from "@/lib/application/status";
import { portalUrl } from "@/lib/application/notifications";
import { recordAudit, recordEvent, SYSTEM_ACTOR, type Actor } from "@/lib/audit";
import type { CurrentAdmin } from "@/lib/auth/admin";
import { sendAndRecord } from "@/lib/email/communications";
import type { EmailContent } from "@/lib/email/layout";
import { loanApprovedEmail, loanPaidOffEmail, paymentReceivedEmail, paymentReminderEmail } from "@/lib/email/templates";
import { logger } from "@/lib/security/logger";
import type { approveLoanSchema, recordPaymentSchema } from "@/lib/validation/loans";
import { allocatePayments, buildFlatSchedule, fromCents, reminderKindFor, summarizeLoan, toCents, toIsoDate } from "./schedule";
import { getLoanSettings } from "./settings";

export class LoanError extends Error {}
export type LoanResult = { ok: true; message: string; emailStatus?: string } | { ok: false; error: string };

const adminActor = (a: CurrentAdmin): Actor => ({ type: "ADMIN", adminId: a.id });
const todayIso = () => toIsoDate(new Date());
const displayDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

function wrap(fn: () => Promise<LoanResult>): Promise<LoanResult> {
  return fn().catch((err: unknown) => {
    if (err instanceof LoanError || err instanceof InvalidTransitionError) return { ok: false, error: err.message };
    throw err;
  });
}

async function notifyApplicant(
  ctx: { applicationId: string; email: string },
  type: CommunicationType,
  email: EmailContent,
  portalBody: string,
  senderAdminId: string | null,
) {
  const res = await sendAndRecord({ applicationId: ctx.applicationId, type, to: ctx.email, email, senderAdminId, portalBody, visibleToApplicant: true });
  return res.status;
}

// --- Approval --------------------------------------------------------------------------

export function approveLoan(admin: CurrentAdmin, input: z.output<typeof approveLoanSchema>) {
  return wrap(async () => {
    const db = getDb();
    const [app] = await db
      .select({ id: applications.id, reference: applications.reference, status: applications.status, applicantId: applications.applicantId, email: applicants.email, firstName: applicants.firstName })
      .from(applications)
      .innerJoin(applicants, eq(applicants.id, applications.applicantId))
      .where(eq(applications.id, input.applicationId));
    if (!app) throw new LoanError("Application not found.");
    assertTransition(app.status, "APPROVED");
    if (input.firstDueDate < todayIso()) throw new LoanError("The first due date can't be in the past.");

    const schedule = buildFlatSchedule({
      principal: input.principal,
      annualRatePct: input.annualRatePct,
      termMonths: input.termMonths,
      frequency: input.frequency,
      firstDueDate: input.firstDueDate,
    });

    await db.transaction(async (tx) => {
      const moved = await tx
        .update(applications)
        .set({ status: "APPROVED", statusChangedAt: new Date() })
        .where(and(eq(applications.id, app.id), eq(applications.status, app.status)))
        .returning({ id: applications.id });
      if (moved.length === 0) throw new LoanError("This application was updated by someone else. Refresh and try again.");

      const [loan] = await tx
        .insert(loans)
        .values({
          applicationId: app.id,
          applicantId: app.applicantId,
          principal: input.principal,
          currency: input.currency,
          interestRate: String(input.annualRatePct),
          totalInterest: schedule.totalInterest,
          totalRepayable: schedule.totalRepayable,
          termMonths: input.termMonths,
          repaymentFrequency: input.frequency,
          installmentCount: schedule.installmentCount,
          firstDueDate: input.firstDueDate,
          approvedByAdminId: admin.id,
        })
        .returning({ id: loans.id });
      if (!loan) throw new Error("Loan insert failed");
      await tx.insert(loanInstallments).values(schedule.installments.map((i) => ({ ...i, loanId: loan.id })));

      const actor = adminActor(admin);
      await recordEvent(
        {
          applicationId: app.id,
          type: "loan.approved",
          summary: `Loan approved: ${formatMoney(input.principal, input.currency)} at ${input.annualRatePct}% flat p.a. over ${input.termMonths} months`,
          actor,
          metadata: { from: app.status, to: "APPROVED", installments: schedule.installmentCount },
        },
        tx,
      );
      await recordAudit({ actor, action: "loan.approved", applicationId: app.id, targetType: "loan", targetId: loan.id, metadata: { principal: input.principal, currency: input.currency, rate: input.annualRatePct, termMonths: input.termMonths } }, tx);
    });

    let emailStatus: string | undefined;
    if (input.notify) {
      const settings = await getLoanSettings();
      const money = (v: string) => formatMoney(v, input.currency);
      emailStatus = await notifyApplicant(
        { applicationId: app.id, email: app.email },
        "LOAN_APPROVED",
        loanApprovedEmail({
          firstName: app.firstName,
          reference: app.reference,
          amount: money(input.principal),
          totalRepayable: money(schedule.totalRepayable),
          installment: money(schedule.regularInstallment),
          installmentCount: schedule.installmentCount,
          frequencyLabel: REPAYMENT_FREQUENCY_LABELS[input.frequency],
          firstDueDate: displayDate(input.firstDueDate),
          rateLabel: `${input.annualRatePct}% per year (flat), ${money(schedule.totalInterest)} in total`,
          message: input.message,
          instructions: settings.repaymentInstructions,
          portalUrl: `${portalUrl()}/applications/${app.id}`,
        }),
        input.message ?? `Your loan of ${money(input.principal)} has been approved. Your first payment is due ${displayDate(input.firstDueDate)}.`,
        admin.id,
      );
    }
    return { ok: true, message: "Loan approved and repayment schedule created.", emailStatus };
  });
}

// --- Disbursement -------------------------------------------------------------------------

export function markDisbursed(admin: CurrentAdmin, loanId: string, disbursedOn: string) {
  return wrap(async () => {
    const db = getDb();
    const [loan] = await db.update(loans).set({ status: "ACTIVE", disbursedAt: new Date(`${disbursedOn}T12:00:00Z`) }).where(and(eq(loans.id, loanId), eq(loans.status, "PENDING_DISBURSEMENT"))).returning({ id: loans.id, applicationId: loans.applicationId });
    if (!loan) throw new LoanError("This loan isn't awaiting disbursement.");
    await recordEvent({ applicationId: loan.applicationId, type: "loan.disbursed", summary: `Loan marked as disbursed on ${displayDate(disbursedOn)}`, actor: adminActor(admin) });
    await recordAudit({ actor: adminActor(admin), action: "loan.disbursed", applicationId: loan.applicationId, targetType: "loan", targetId: loan.id });
    return { ok: true, message: "Loan marked as disbursed. Repayment reminders are now active." };
  });
}

// --- Payments ---------------------------------------------------------------------------------

/** Re-apply all non-voided payments to the schedule. Returns whether the loan is fully repaid. */
async function reallocate(tx: Transaction, loanId: string): Promise<{ fullyPaid: boolean; totalPaid: string }> {
  const installments = await tx.select().from(loanInstallments).where(eq(loanInstallments.loanId, loanId)).orderBy(asc(loanInstallments.sequence));
  const [sum] = await tx
    .select({ total: sql<string>`coalesce(sum(${loanPayments.amount}), 0)` })
    .from(loanPayments)
    .where(and(eq(loanPayments.loanId, loanId), isNull(loanPayments.voidedAt)));
  const totalPaid = sum?.total ?? "0";
  const allocation = allocatePayments(
    installments.map((i) => i.amountDue),
    totalPaid,
  );
  if (!allocation) throw new LoanError("This payment would exceed the total amount repayable.");
  const now = new Date();
  for (const [idx, inst] of installments.entries()) {
    const a = allocation[idx]!;
    if (a.amountPaid === inst.amountPaid && a.status === inst.status) continue;
    await tx
      .update(loanInstallments)
      .set({ amountPaid: a.amountPaid, status: a.status, paidAt: a.status === "PAID" ? (inst.paidAt ?? now) : null })
      .where(eq(loanInstallments.id, inst.id));
  }
  return { fullyPaid: allocation.every((a) => a.status === "PAID"), totalPaid: fromCents(toCents(totalPaid)) };
}

async function loadLoanContext(loanId: string) {
  const [row] = await getDb()
    .select({
      id: loans.id,
      status: loans.status,
      currency: loans.currency,
      applicationId: loans.applicationId,
      reference: applications.reference,
      applicationStatus: applications.status,
      email: applicants.email,
      firstName: applicants.firstName,
    })
    .from(loans)
    .innerJoin(applications, eq(applications.id, loans.applicationId))
    .innerJoin(applicants, eq(applicants.id, loans.applicantId))
    .where(eq(loans.id, loanId));
  if (!row) throw new LoanError("Loan not found.");
  return row;
}

async function currentSummary(loanId: string) {
  const installments = await getDb()
    .select({ dueDate: loanInstallments.dueDate, amountDue: loanInstallments.amountDue, amountPaid: loanInstallments.amountPaid, status: loanInstallments.status })
    .from(loanInstallments)
    .where(eq(loanInstallments.loanId, loanId));
  return summarizeLoan(installments, todayIso());
}

export function recordPayment(admin: CurrentAdmin, input: z.output<typeof recordPaymentSchema>) {
  return wrap(async () => {
    const loan = await loadLoanContext(input.loanId);
    if (loan.status !== "ACTIVE") throw new LoanError(loan.status === "PENDING_DISBURSEMENT" ? "Mark the loan as disbursed before recording payments." : "This loan isn't active.");
    if (input.paidOn > todayIso()) throw new LoanError("The payment date can't be in the future.");

    const result = await getDb().transaction(async (tx) => {
      const [payment] = await tx
        .insert(loanPayments)
        .values({ loanId: loan.id, amount: input.amount, paidOn: input.paidOn, method: input.method, reference: input.reference ?? null, note: input.note ?? null, recordedByAdminId: admin.id })
        .returning({ id: loanPayments.id });
      const alloc = await reallocate(tx, loan.id);
      if (alloc.fullyPaid) {
        await tx.update(loans).set({ status: "PAID_OFF", paidOffAt: new Date() }).where(eq(loans.id, loan.id));
        if (loan.applicationStatus === "APPROVED") {
          await tx.update(applications).set({ status: "COMPLETED", statusChangedAt: new Date() }).where(eq(applications.id, loan.applicationId));
        }
      }
      const actor = adminActor(admin);
      await recordEvent({ applicationId: loan.applicationId, type: "loan.payment", summary: `Payment recorded: ${formatMoney(input.amount, loan.currency)}`, actor, metadata: { method: input.method } }, tx);
      await recordAudit({ actor, action: "loan.payment_recorded", applicationId: loan.applicationId, targetType: "loan_payment", targetId: payment?.id, metadata: { amount: input.amount, method: input.method } }, tx);
      if (alloc.fullyPaid) {
        await recordEvent({ applicationId: loan.applicationId, type: "loan.paid_off", summary: "Loan fully repaid. Status changed to Completed", actor }, tx);
        await recordAudit({ actor, action: "loan.paid_off", applicationId: loan.applicationId, targetType: "loan", targetId: loan.id }, tx);
      }
      return alloc;
    });

    let emailStatus: string | undefined;
    if (input.notify) {
      const money = (v: string) => formatMoney(v, loan.currency);
      const url = `${portalUrl()}/applications/${loan.applicationId}`;
      if (result.fullyPaid) {
        emailStatus = await notifyApplicant(loan, "LOAN_PAID_OFF", loanPaidOffEmail({ firstName: loan.firstName, reference: loan.reference, totalPaid: money(result.totalPaid), portalUrl: url }), "Your loan has been repaid in full. Thank you.", admin.id);
      } else {
        const summary = await currentSummary(loan.id);
        emailStatus = await notifyApplicant(
          loan,
          "PAYMENT_RECEIVED",
          paymentReceivedEmail({
            firstName: loan.firstName,
            reference: loan.reference,
            amount: money(input.amount),
            paidOn: displayDate(input.paidOn),
            outstanding: money(summary.outstanding),
            nextDue: summary.nextDue ? `${money(summary.nextDue.amount)} on ${displayDate(summary.nextDue.dueDate)}` : null,
            portalUrl: url,
          }),
          `We've recorded your payment of ${money(input.amount)}. Remaining balance: ${money(summary.outstanding)}.`,
          admin.id,
        );
      }
    }
    return { ok: true, message: result.fullyPaid ? "Payment recorded. The loan is now fully repaid." : "Payment recorded.", emailStatus };
  });
}

export function voidPayment(admin: CurrentAdmin, paymentId: string, reason: string) {
  return wrap(async () => {
    const db = getDb();
    const [payment] = await db.select({ id: loanPayments.id, loanId: loanPayments.loanId, amount: loanPayments.amount, voidedAt: loanPayments.voidedAt }).from(loanPayments).where(eq(loanPayments.id, paymentId));
    if (!payment || payment.voidedAt) throw new LoanError("Payment not found or already voided.");
    const loan = await loadLoanContext(payment.loanId);

    await db.transaction(async (tx) => {
      await tx.update(loanPayments).set({ voidedAt: new Date(), voidedByAdminId: admin.id, voidReason: reason }).where(eq(loanPayments.id, payment.id));
      const alloc = await reallocate(tx, loan.id);
      // Voiding a payment can re-open a repaid loan.
      if (!alloc.fullyPaid && loan.status === "PAID_OFF") {
        await tx.update(loans).set({ status: "ACTIVE", paidOffAt: null }).where(eq(loans.id, loan.id));
        await tx.update(applications).set({ status: "APPROVED", statusChangedAt: new Date() }).where(and(eq(applications.id, loan.applicationId), eq(applications.status, "COMPLETED")));
      }
      const actor = adminActor(admin);
      await recordEvent({ applicationId: loan.applicationId, type: "loan.payment_voided", summary: `Payment of ${formatMoney(payment.amount, loan.currency)} voided`, actor, metadata: { reason } }, tx);
      await recordAudit({ actor, action: "loan.payment_voided", applicationId: loan.applicationId, targetType: "loan_payment", targetId: payment.id, metadata: { reason } }, tx);
    });
    return { ok: true, message: "Payment voided and balances recalculated." };
  });
}

// --- Reads -----------------------------------------------------------------------------------

export async function getLoanByApplication(applicationId: string) {
  const db = getDb();
  const [loan] = await db.select().from(loans).where(eq(loans.applicationId, applicationId)).limit(1);
  if (!loan) return null;
  const [installments, payments] = await Promise.all([
    db.select().from(loanInstallments).where(eq(loanInstallments.loanId, loan.id)).orderBy(asc(loanInstallments.sequence)),
    db
      .select({
        id: loanPayments.id,
        amount: loanPayments.amount,
        paidOn: loanPayments.paidOn,
        method: loanPayments.method,
        reference: loanPayments.reference,
        note: loanPayments.note,
        voidedAt: loanPayments.voidedAt,
        voidReason: loanPayments.voidReason,
        recordedBy: admins.name,
        createdAt: loanPayments.createdAt,
      })
      .from(loanPayments)
      .leftJoin(admins, eq(admins.id, loanPayments.recordedByAdminId))
      .where(eq(loanPayments.loanId, loan.id))
      .orderBy(desc(loanPayments.paidOn), desc(loanPayments.createdAt)),
  ]);
  return { loan, installments, payments, summary: summarizeLoan(installments, todayIso()) };
}

export type LoanDetail = NonNullable<Awaited<ReturnType<typeof getLoanByApplication>>>;

/** Applicant-scoped read: only returns a loan on the applicant's own application. */
export async function getApplicantLoan(applicantId: string, applicationId: string) {
  const [owned] = await getDb()
    .select({ id: loans.id })
    .from(loans)
    .where(and(eq(loans.applicationId, applicationId), eq(loans.applicantId, applicantId)))
    .limit(1);
  if (!owned) return null;
  const detail = await getLoanByApplication(applicationId);
  if (!detail) return null;
  // Applicants never see internal payment notes or who recorded them.
  return {
    ...detail,
    payments: detail.payments
      .filter((p) => !p.voidedAt)
      .map((p) => ({ id: p.id, amount: p.amount, paidOn: p.paidOn, method: p.method, reference: p.reference })),
  };
}

export const LOAN_FILTERS = ["all", "pending", "active", "overdue", "due_soon", "paid_off"] as const;
export type LoanFilter = (typeof LOAN_FILTERS)[number];

export async function listLoans(filter: LoanFilter) {
  const db = getDb();
  const today = todayIso();
  const soon = toIsoDate(new Date(Date.now() + 7 * 86_400_000));
  const rows = await db
    .select({
      id: loans.id,
      applicationId: loans.applicationId,
      reference: applications.reference,
      firstName: applicants.firstName,
      lastName: applicants.lastName,
      status: loans.status,
      principal: loans.principal,
      currency: loans.currency,
      totalRepayable: loans.totalRepayable,
      approvedAt: loans.approvedAt,
    })
    .from(loans)
    .innerJoin(applications, eq(applications.id, loans.applicationId))
    .innerJoin(applicants, eq(applicants.id, loans.applicantId))
    .orderBy(desc(loans.approvedAt))
    .limit(500);
  if (rows.length === 0) return [];

  const installments = await db
    .select({ loanId: loanInstallments.loanId, dueDate: loanInstallments.dueDate, amountDue: loanInstallments.amountDue, amountPaid: loanInstallments.amountPaid, status: loanInstallments.status })
    .from(loanInstallments)
    .where(inArray(loanInstallments.loanId, rows.map((r) => r.id)));
  const byLoan = new Map<string, typeof installments>();
  for (const i of installments) byLoan.set(i.loanId, [...(byLoan.get(i.loanId) ?? []), i]);

  const enriched = rows.map((r) => ({ ...r, summary: summarizeLoan(byLoan.get(r.id) ?? [], today) }));
  return enriched.filter((r) => {
    switch (filter) {
      case "pending":
        return r.status === "PENDING_DISBURSEMENT";
      case "active":
        return r.status === "ACTIVE";
      case "overdue":
        return r.status === "ACTIVE" && r.summary.overdueCount > 0;
      case "due_soon":
        return r.status === "ACTIVE" && r.summary.nextDue !== null && r.summary.nextDue.dueDate <= soon;
      case "paid_off":
        return r.status === "PAID_OFF";
      default:
        return true;
    }
  });
}

export async function getLoanCounts() {
  const all = await listLoans("all");
  const soon = toIsoDate(new Date(Date.now() + 7 * 86_400_000));
  return {
    active: all.filter((l) => l.status === "ACTIVE").length,
    overdue: all.filter((l) => l.status === "ACTIVE" && l.summary.overdueCount > 0).length,
    dueSoon: all.filter((l) => l.status === "ACTIVE" && l.summary.nextDue && l.summary.nextDue.dueDate <= soon).length,
    pending: all.filter((l) => l.status === "PENDING_DISBURSEMENT").length,
  };
}

// --- Reminders (daily cron) -------------------------------------------------------------------

export async function runPaymentReminders(today = todayIso()): Promise<{ sent: number; failed: number }> {
  const db = getDb();
  const from = toIsoDate(new Date(new Date(`${today}T00:00:00Z`).getTime() - 14 * 86_400_000));
  const to = toIsoDate(new Date(new Date(`${today}T00:00:00Z`).getTime() + 3 * 86_400_000));

  const due = await db
    .select({
      installmentId: loanInstallments.id,
      dueDate: loanInstallments.dueDate,
      amountDue: loanInstallments.amountDue,
      amountPaid: loanInstallments.amountPaid,
      loanId: loans.id,
      currency: loans.currency,
      applicationId: loans.applicationId,
      reference: applications.reference,
      email: applicants.email,
      firstName: applicants.firstName,
    })
    .from(loanInstallments)
    .innerJoin(loans, eq(loans.id, loanInstallments.loanId))
    .innerJoin(applications, eq(applications.id, loans.applicationId))
    .innerJoin(applicants, eq(applicants.id, loans.applicantId))
    .where(and(eq(loans.status, "ACTIVE"), ne(loanInstallments.status, "PAID"), gte(loanInstallments.dueDate, from), lte(loanInstallments.dueDate, to)));

  if (due.length === 0) return { sent: 0, failed: 0 };
  const settings = await getLoanSettings();
  let sent = 0;
  let failed = 0;

  for (const item of due) {
    const kind = reminderKindFor(item.dueDate, today) as ReminderKind | null;
    if (!kind) continue;
    // Claim the reminder first so concurrent runs can't double-send.
    const [claim] = await db.insert(loanReminders).values({ installmentId: item.installmentId, kind }).onConflictDoNothing().returning({ id: loanReminders.id });
    if (!claim) continue;

    const summary = await currentSummary(item.loanId);
    const money = (v: string) => formatMoney(v, item.currency);
    const amount = money(fromCents(toCents(item.amountDue) - toCents(item.amountPaid)));
    const status = await notifyApplicant(
      item,
      kind.startsWith("OVERDUE") ? "PAYMENT_OVERDUE" : "PAYMENT_REMINDER",
      paymentReminderEmail({
        firstName: item.firstName,
        reference: item.reference,
        kind,
        amount,
        dueDate: displayDate(item.dueDate),
        outstanding: money(summary.outstanding),
        instructions: settings.repaymentInstructions,
        portalUrl: `${portalUrl()}/applications/${item.applicationId}`,
      }),
      kind.startsWith("OVERDUE") ? `Your payment of ${amount} due ${displayDate(item.dueDate)} is overdue.` : `Reminder: ${amount} due ${displayDate(item.dueDate)}.`,
      null,
    );
    if (status === "SENT") {
      sent++;
      await recordEvent({ applicationId: item.applicationId, type: "loan.reminder", summary: `Payment reminder sent (${kind.toLowerCase().replace("_", " ")})`, actor: SYSTEM_ACTOR }).catch(() => undefined);
    } else {
      failed++;
      // Release the claim so tomorrow's run retries.
      await db.delete(loanReminders).where(eq(loanReminders.id, claim.id));
      logger.warn("Payment reminder failed", { kind });
    }
  }
  return { sent, failed };
}
