import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { listAuditActions, listAuditLogs } from "@/lib/admin/settings";
import { requireAdminPage } from "@/lib/auth/admin";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Audit log" };

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium" });

function summarize(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  return Object.entries(meta)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(", ")
    .slice(0, 160);
}

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdminPage("audit.view");
  const sp = await searchParams;
  const action = typeof sp.action === "string" && /^[a-z_.]{1,60}$/.test(sp.action) ? sp.action : undefined;
  const page = typeof sp.page === "string" ? Number(sp.page) || 1 : 1;
  const [{ rows, total, page: current, pages }, actions] = await Promise.all([listAuditLogs({ action, page }), listAuditActions()]);
  const href = (p: number) => `/admin/audit?${new URLSearchParams({ ...(action ? { action } : {}), page: String(p) })}`;

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Audit log</h1>
          <p className={styles.pageSubtitle}>{total.toLocaleString("en")} recorded actions. Sensitive values are never stored here.</p>
        </div>
      </div>
      <section className={styles.panel}>
        <Form action="/admin/audit" className={styles.filters} style={{ gridTemplateColumns: "1fr auto" }}>
          <label className={styles.filterField}>
            Action
            <select name="action" defaultValue={action ?? ""}>
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" size="sm">
            Filter
          </Button>
        </Form>
        {rows.length === 0 ? (
          <EmptyState title="No audit entries" />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Application</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className={styles.muted} style={{ whiteSpace: "nowrap" }}>
                      {dateTime.format(r.createdAt)}
                    </td>
                    <td>{r.actorName ?? (r.actorType === "APPLICANT" ? "Applicant" : r.actorType === "SYSTEM" ? "System" : "Admin")}</td>
                    <td className={styles.mono}>{r.action}</td>
                    <td>
                      {r.applicationId && r.reference ? (
                        <Link href={`/admin/applications/${r.applicationId}`} className={styles.mono}>
                          {r.reference}
                        </Link>
                      ) : (
                        <span className={styles.muted}>-</span>
                      )}
                    </td>
                    <td className={styles.muted}>{summarize(r.metadata)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <nav className={styles.pagination} aria-label="Pagination">
            <span>
              Page {current} of {pages}
            </span>
            <span className={styles.pageLinks}>
              {current > 1 && <Link href={href(current - 1)}>Previous</Link>}
              {current < pages && <Link href={href(current + 1)}>Next</Link>}
            </span>
          </nav>
        )}
      </section>
    </>
  );
}
