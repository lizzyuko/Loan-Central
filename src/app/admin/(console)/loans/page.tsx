import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/Feedback";
import { formatDue, LoanStatusBadge } from "@/components/loans/LoanDisplay";
import { formatMoney } from "@/config/currencies";
import { requireAdminPage } from "@/lib/auth/admin";
import { LOAN_FILTERS, listLoans, type LoanFilter } from "@/lib/loans/service";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Loans" };

const FILTER_LABELS: Record<LoanFilter, string> = {
  all: "All",
  pending: "Awaiting disbursement",
  active: "Active",
  due_soon: "Due in 7 days",
  overdue: "Overdue",
  paid_off: "Repaid",
};

export default async function LoansPage({ searchParams }: PageProps<"/admin/loans">) {
  await requireAdminPage("loans.manage");
  const sp = await searchParams;
  const filter = (LOAN_FILTERS as readonly string[]).includes(String(sp.filter)) ? (sp.filter as LoanFilter) : "all";
  const rows = await listLoans(filter);

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Loans</h1>
          <p className={styles.pageSubtitle}>Approved loans, repayment progress and overdue payments.</p>
        </div>
      </div>

      <nav className={styles.tabs} aria-label="Loan filters">
        {LOAN_FILTERS.map((f) => (
          <Link key={f} href={f === "all" ? "/admin/loans" : `/admin/loans?filter=${f}`} className={styles.tab} aria-current={filter === f ? "page" : undefined}>
            {FILTER_LABELS[f]}
          </Link>
        ))}
      </nav>

      <section className={styles.panel}>
        {rows.length === 0 ? (
          <EmptyState title="No loans here">Loans appear once an application is approved from its final review.</EmptyState>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Applicant</th>
                  <th className={styles.num}>Approved</th>
                  <th className={styles.num}>Outstanding</th>
                  <th>Next payment</th>
                  <th className={styles.num}>Overdue</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const money = (v: string) => formatMoney(v, r.currency);
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/admin/applications/${r.applicationId}`} className={`${styles.rowLink} ${styles.mono}`}>
                          {r.reference}
                        </Link>
                      </td>
                      <td>
                        {r.firstName} {r.lastName}
                      </td>
                      <td className={styles.num}>{money(r.principal)}</td>
                      <td className={styles.num}>{money(r.summary.outstanding)}</td>
                      <td>{r.summary.nextDue ? `${money(r.summary.nextDue.amount)} · ${formatDue(r.summary.nextDue.dueDate)}` : <span className={styles.muted}>-</span>}</td>
                      <td className={styles.num}>{r.summary.overdueCount > 0 ? money(r.summary.overdueAmount) : <span className={styles.muted}>-</span>}</td>
                      <td>
                        <LoanStatusBadge status={r.status} overdue={r.summary.overdueCount > 0} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
