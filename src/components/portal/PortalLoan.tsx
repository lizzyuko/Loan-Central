import { formatMoney } from "@/config/currencies";
import { REPAYMENT_FREQUENCY_LABELS } from "@/config/site";
import { Alert } from "@/components/ui/Feedback";
import { formatDue, LoanStats, LoanStatusBadge, ScheduleTable } from "@/components/loans/LoanDisplay";
import { toIsoDate } from "@/lib/loans/schedule";
import type { getApplicantLoan } from "@/lib/loans/service";
import { PAYMENT_METHODS } from "@/lib/validation/loans";
import styles from "@/app/portal/(app)/portal.module.css";

type ApplicantLoan = NonNullable<Awaited<ReturnType<typeof getApplicantLoan>>>;

export function PortalLoan({ data, instructions }: { data: ApplicantLoan; instructions: string }) {
  const { loan, installments, payments, summary } = data;
  const money = (v: string) => formatMoney(v, loan.currency);
  const todayIso = toIsoDate(new Date());

  return (
    <section className={styles.card} aria-labelledby="loan-title">
      <div className={styles.statusHead}>
        <h2 id="loan-title" className={styles.cardTitle}>
          Your loan
        </h2>
        <LoanStatusBadge status={loan.status} overdue={summary.overdueCount > 0} />
      </div>

      {loan.status === "PENDING_DISBURSEMENT" && (
        <Alert tone="success" title="Your loan is approved">
          We&apos;re preparing your funds. Your first payment of {money(installments[0]?.amountDue ?? "0")} is due on {formatDue(loan.firstDueDate)}.
        </Alert>
      )}
      {loan.status === "ACTIVE" && summary.overdueCount > 0 && (
        <Alert tone="danger" title="You have an overdue payment">
          {money(summary.overdueAmount)} is overdue. Please pay as soon as possible, or contact us if you&apos;re having difficulty.
        </Alert>
      )}
      {loan.status === "PAID_OFF" && (
        <Alert tone="success" title="Fully repaid">
          Congratulations, you&apos;ve repaid this loan in full.
        </Alert>
      )}

      <LoanStats summary={summary} currency={loan.currency} totalRepayable={loan.totalRepayable} />

      <dl className={styles.summary}>
        <div>
          <dt>Approved amount</dt>
          <dd>{money(loan.principal)}</dd>
        </div>
        <div>
          <dt>Interest</dt>
          <dd>
            {Number(loan.interestRate)}% flat per year ({money(loan.totalInterest)})
          </dd>
        </div>
        <div>
          <dt>Total to repay</dt>
          <dd>{money(loan.totalRepayable)}</dd>
        </div>
        <div>
          <dt>Repayments</dt>
          <dd>
            {loan.installmentCount}, {REPAYMENT_FREQUENCY_LABELS[loan.repaymentFrequency].toLowerCase()}
          </dd>
        </div>
      </dl>

      {instructions && loan.status !== "PAID_OFF" && (
        <div>
          <h3 className={styles.messageSubject}>How to pay</h3>
          <p className={styles.messageBody}>{instructions}</p>
        </div>
      )}

      <h3 className={styles.messageSubject}>Repayment schedule</h3>
      <ScheduleTable installments={installments} currency={loan.currency} todayIso={todayIso} />

      {payments.length > 0 && (
        <>
          <h3 className={styles.messageSubject}>Payments received</h3>
          <ul className={styles.messages}>
            {payments.map((p) => (
              <li key={p.id} className={styles.message}>
                <p className={styles.messageSubject}>{money(p.amount)}</p>
                <p className={styles.muted}>
                  {formatDue(p.paidOn)} · {PAYMENT_METHODS.find((m) => m.value === p.method)?.label ?? p.method}
                  {p.reference ? ` · Ref ${p.reference}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
