import { formatMoney } from "@/config/currencies";
import { REPAYMENT_FREQUENCY_LABELS } from "@/config/site";
import { Badge } from "@/components/ui/Feedback";
import { formatDue, LoanStats, LoanStatusBadge, ScheduleTable } from "@/components/loans/LoanDisplay";
import { toIsoDate } from "@/lib/loans/schedule";
import type { LoanDetail } from "@/lib/loans/service";
import { PAYMENT_METHODS } from "@/lib/validation/loans";
import { DisburseForm, RecordPaymentForm, VoidPaymentButton } from "./LoanForms";
import styles from "./LoanSection.module.css";

const methodLabel = (m: string) => PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m;

export function LoanSection({ detail, canManage, canVoid }: { detail: LoanDetail; canManage: boolean; canVoid: boolean }) {
  const { loan, installments, payments, summary } = detail;
  const money = (v: string) => formatMoney(v, loan.currency);
  const todayIso = toIsoDate(new Date());

  return (
    <section className={styles.section} aria-labelledby="loan-title">
      <div className={styles.head}>
        <h2 id="loan-title" className={styles.title}>
          Loan
        </h2>
        <LoanStatusBadge status={loan.status} overdue={summary.overdueCount > 0} />
      </div>

      <dl className={styles.terms}>
        <div>
          <dt>Approved amount</dt>
          <dd>{money(loan.principal)}</dd>
        </div>
        <div>
          <dt>Interest</dt>
          <dd>
            {Number(loan.interestRate)}% flat p.a. ({money(loan.totalInterest)})
          </dd>
        </div>
        <div>
          <dt>Total repayable</dt>
          <dd>{money(loan.totalRepayable)}</dd>
        </div>
        <div>
          <dt>Repayments</dt>
          <dd>
            {loan.installmentCount} × {REPAYMENT_FREQUENCY_LABELS[loan.repaymentFrequency].toLowerCase()} over {loan.termMonths} months
          </dd>
        </div>
        <div>
          <dt>First due</dt>
          <dd>{formatDue(loan.firstDueDate)}</dd>
        </div>
        <div>
          <dt>Disbursed</dt>
          <dd>{loan.disbursedAt ? formatDue(toIsoDate(loan.disbursedAt)) : "Not yet"}</dd>
        </div>
      </dl>

      {loan.status !== "PENDING_DISBURSEMENT" && <LoanStats summary={summary} currency={loan.currency} totalRepayable={loan.totalRepayable} />}

      {canManage && loan.status === "PENDING_DISBURSEMENT" && (
        <div className={styles.action}>
          <p className={styles.muted}>Once the funds are sent, mark the loan as disbursed. Payment reminders only start after this.</p>
          <DisburseForm loanId={loan.id} />
        </div>
      )}

      {canManage && loan.status === "ACTIVE" && (
        <details className={styles.action}>
          <summary className={styles.summary}>Record a payment</summary>
          <RecordPaymentForm loanId={loan.id} currency={loan.currency} suggested={summary.overdueCount > 0 ? null : (summary.nextDue?.amount ?? null)} />
        </details>
      )}

      <h3 className={styles.subTitle}>Repayment schedule</h3>
      <ScheduleTable installments={installments} currency={loan.currency} todayIso={todayIso} />

      <h3 className={styles.subTitle}>Payments</h3>
      {payments.length === 0 ? (
        <p className={styles.muted}>No payments recorded yet.</p>
      ) : (
        <ul className={styles.payments}>
          {payments.map((p) => (
            <li key={p.id} className={styles.payment} data-voided={p.voidedAt ? true : undefined}>
              <div>
                <p className={styles.paymentAmount}>
                  {money(p.amount)} {p.voidedAt && <Badge tone="danger">Voided</Badge>}
                </p>
                <p className={styles.muted}>
                  {formatDue(p.paidOn)} · {methodLabel(p.method)}
                  {p.reference ? ` · Ref ${p.reference}` : ""} · recorded by {p.recordedBy ?? "former admin"}
                </p>
                {p.note && <p className={styles.muted}>Note: {p.note}</p>}
                {p.voidReason && <p className={styles.muted}>Void reason: {p.voidReason}</p>}
              </div>
              {canVoid && !p.voidedAt && <VoidPaymentButton paymentId={p.id} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
