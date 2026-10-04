import type { InstallmentStatus, LoanStatus } from "@/db/schema/enums";
import { Badge } from "@/components/ui/Feedback";
import { formatMoney } from "@/config/currencies";
import type { LoanSummary } from "@/lib/loans/schedule";
import styles from "./LoanDisplay.module.css";

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  PENDING_DISBURSEMENT: "Awaiting disbursement",
  ACTIVE: "Active",
  PAID_OFF: "Repaid",
  DEFAULTED: "Defaulted",
  CANCELLED: "Cancelled",
};

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const formatDue = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

export function LoanStatusBadge({ status, overdue }: { status: LoanStatus; overdue?: boolean }) {
  if (status === "ACTIVE" && overdue) return <Badge tone="danger">Overdue</Badge>;
  const tone = status === "ACTIVE" ? "info" : status === "PAID_OFF" ? "success" : status === "PENDING_DISBURSEMENT" ? "warning" : "danger";
  return <Badge tone={tone}>{LOAN_STATUS_LABELS[status]}</Badge>;
}

export function LoanStats({ summary, currency, totalRepayable }: { summary: LoanSummary; currency: string; totalRepayable: string }) {
  const money = (v: string) => formatMoney(v, currency);
  return (
    <dl className={styles.stats}>
      <div>
        <dt>Outstanding</dt>
        <dd>{money(summary.outstanding)}</dd>
      </div>
      <div>
        <dt>Paid so far</dt>
        <dd>
          {money(summary.totalPaid)} <span className={styles.of}>of {money(totalRepayable)}</span>
        </dd>
      </div>
      <div>
        <dt>Next payment</dt>
        <dd>{summary.nextDue ? `${money(summary.nextDue.amount)} on ${formatDue(summary.nextDue.dueDate)}` : "None"}</dd>
      </div>
      <div data-alert={summary.overdueCount > 0 || undefined}>
        <dt>Overdue</dt>
        <dd>{summary.overdueCount > 0 ? `${money(summary.overdueAmount)} (${summary.overdueCount})` : "Nothing overdue"}</dd>
      </div>
    </dl>
  );
}

interface Row {
  id: string;
  sequence: number;
  dueDate: string;
  amountDue: string;
  amountPaid: string;
  status: InstallmentStatus;
}

export function ScheduleTable({ installments, currency, todayIso }: { installments: Row[]; currency: string; todayIso: string }) {
  const money = (v: string) => formatMoney(v, currency);
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="visually-hidden">Repayment schedule</caption>
        <thead>
          <tr>
            <th>#</th>
            <th>Due date</th>
            <th className={styles.num}>Amount</th>
            <th className={styles.num}>Paid</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {installments.map((i) => {
            const overdue = i.status !== "PAID" && i.dueDate < todayIso;
            return (
              <tr key={i.id} data-overdue={overdue || undefined}>
                <td>{i.sequence}</td>
                <td>{formatDue(i.dueDate)}</td>
                <td className={styles.num}>{money(i.amountDue)}</td>
                <td className={styles.num}>{money(i.amountPaid)}</td>
                <td>
                  {i.status === "PAID" ? (
                    <Badge tone="success">Paid</Badge>
                  ) : overdue ? (
                    <Badge tone="danger">Overdue</Badge>
                  ) : i.status === "PARTIAL" ? (
                    <Badge tone="warning">Part paid</Badge>
                  ) : i.dueDate === todayIso ? (
                    <Badge tone="warning">Due today</Badge>
                  ) : (
                    <Badge>Upcoming</Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
