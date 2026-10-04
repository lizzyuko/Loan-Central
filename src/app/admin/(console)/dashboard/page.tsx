import type { Metadata } from "next";
import Link from "next/link";
import { ApplicationTable } from "@/components/admin/ApplicationTable";
import { Alert } from "@/components/ui/Feedback";
import { can, requireAdminPage } from "@/lib/auth/admin";
import { getLoanCounts } from "@/lib/loans/service";
import { getStatusCounts, getSubmittedInLastDays, listApplications } from "@/lib/admin/queries";
import type { ApplicationStatus } from "@/db/schema/enums";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/admin/dashboard">) {
  const admin = await requireAdminPage();
  const params = await searchParams;
  const showLoans = can(admin, "loans.manage");
  const [counts, newThisWeek, recent, loanCounts] = await Promise.all([
    getStatusCounts(),
    getSubmittedInLastDays(7),
    listApplications({ sort: "submitted", dir: "desc" }),
    showLoans ? getLoanCounts() : Promise.resolve(null),
  ]);

  const cards: { label: string; value: number; status?: ApplicationStatus }[] = [
    { label: "Total applications", value: counts.total },
    { label: "New (awaiting review)", value: counts.SUBMITTED, status: "SUBMITTED" },
    { label: "Under review", value: counts.UNDER_REVIEW, status: "UNDER_REVIEW" },
    { label: "Awaiting information", value: counts.MORE_INFORMATION_REQUIRED, status: "MORE_INFORMATION_REQUIRED" },
    { label: "Potentially eligible", value: counts.ELIGIBLE + counts.ACCOUNT_DETAILS_REQUESTED, status: "ELIGIBLE" },
    { label: "Not eligible", value: counts.NOT_ELIGIBLE, status: "NOT_ELIGIBLE" },
    { label: "Final review", value: counts.FINAL_REVIEW, status: "FINAL_REVIEW" },
    { label: "Approved", value: counts.APPROVED, status: "APPROVED" },
    { label: "Completed", value: counts.COMPLETED, status: "COMPLETED" },
  ];

  const loanCards = loanCounts
    ? [
        { label: "Active loans", value: loanCounts.active, filter: "active" },
        { label: "Due in 7 days", value: loanCounts.dueSoon, filter: "due_soon" },
        { label: "Overdue loans", value: loanCounts.overdue, filter: "overdue" },
        { label: "Awaiting disbursement", value: loanCounts.pending, filter: "pending" },
      ]
    : [];

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Welcome back, {admin.name.split(" ")[0]}</h1>
          <p className={styles.pageSubtitle}>{newThisWeek} application{newThisWeek === 1 ? "" : "s"} submitted in the last 7 days.</p>
        </div>
      </div>

      {params.denied && (
        <Alert tone="warning" className={styles.pageHeader}>
          You don&apos;t have permission to view that page.
        </Alert>
      )}

      <div className={styles.stats}>
        {cards.map((c) =>
          c.status ? (
            <Link key={c.label} href={`/admin/applications?status=${c.status}`} className={styles.stat}>
              <span className={styles.statLabel}>{c.label}</span>
              <span className={styles.statValue}>{c.value.toLocaleString("en")}</span>
            </Link>
          ) : (
            <div key={c.label} className={styles.stat}>
              <span className={styles.statLabel}>{c.label}</span>
              <span className={styles.statValue}>{c.value.toLocaleString("en")}</span>
            </div>
          ),
        )}
      </div>

      {loanCards.length > 0 && (
        <>
          <h2 className={styles.sectionLabel}>Loans</h2>
          <div className={styles.stats}>
            {loanCards.map((c) => (
              <Link key={c.label} href={`/admin/loans?filter=${c.filter}`} className={styles.stat}>
                <span className={styles.statLabel}>{c.label}</span>
                <span className={styles.statValue}>{c.value.toLocaleString("en")}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Latest applications</h2>
          <Link href="/admin/applications">View all</Link>
        </div>
        <ApplicationTable rows={recent.rows.slice(0, 8)} emptyText="New applications will appear here." />
      </section>
    </>
  );
}
