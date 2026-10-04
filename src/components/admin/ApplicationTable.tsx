import Link from "next/link";
import { ArrowDown, ArrowUp } from "@phosphor-icons/react/ssr";
import { StatusBadge } from "@/components/application/StatusBadge";
import { EmptyState } from "@/components/ui/Feedback";
import { countryName } from "@/config/countries";
import { formatMoney } from "@/config/currencies";
import type { ApplicationListRow } from "@/lib/admin/queries";
import styles from "./admin.module.css";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

interface SortProps {
  sort?: string;
  dir?: "asc" | "desc";
  hrefFor: (sort: string, dir: "asc" | "desc") => string;
}

function SortHeader({ label, k, sortProps, numeric }: { label: string; k: string; sortProps?: SortProps; numeric?: boolean }) {
  if (!sortProps) return <th className={numeric ? styles.num : undefined}>{label}</th>;
  const active = (sortProps.sort ?? "submitted") === k;
  const nextDir = active && sortProps.dir !== "asc" ? "asc" : "desc";
  return (
    <th className={numeric ? styles.num : undefined} aria-sort={active ? (sortProps.dir === "asc" ? "ascending" : "descending") : undefined}>
      <Link href={sortProps.hrefFor(k, nextDir)} className={styles.sortLink}>
        {label}
        {active && (sortProps.dir === "asc" ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
      </Link>
    </th>
  );
}

export function ApplicationTable({ rows, sortProps, emptyText = "No applications match these filters." }: { rows: ApplicationListRow[]; sortProps?: SortProps; emptyText?: string }) {
  if (rows.length === 0) return <EmptyState title="No applications">{emptyText}</EmptyState>;

  return (
    <>
      <div className={`${styles.tableWrap} ${styles.desktopOnly}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <SortHeader label="Reference" k="reference" sortProps={sortProps} />
              <SortHeader label="Applicant" k="applicant" sortProps={sortProps} />
              <th>Country</th>
              <SortHeader label="Requested" k="amount" sortProps={sortProps} numeric />
              <th>Currency</th>
              <th>Status</th>
              <SortHeader label="Submitted" k="submitted" sortProps={sortProps} />
              <SortHeader label="Last updated" k="updated" sortProps={sortProps} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/admin/applications/${r.id}`} className={`${styles.rowLink} ${styles.mono}`}>
                    {r.reference}
                  </Link>
                </td>
                <td>
                  <div>{r.applicantName}</div>
                  <div className={styles.muted}>{r.productName ?? "No product selected"}</div>
                </td>
                <td>{countryName(r.country)}</td>
                <td className={styles.num}>{formatMoney(r.amount, r.currency)}</td>
                <td className={styles.mono}>{r.currency}</td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td className={styles.muted}>{dateFmt.format(r.submittedAt)}</td>
                <td className={styles.muted}>{dateFmt.format(r.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className={`${styles.cards} ${styles.mobileOnly}`}>
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/applications/${r.id}`} className={styles.cardRow}>
              <span className={styles.cardTop}>
                <strong>{r.applicantName}</strong>
                <StatusBadge status={r.status} />
              </span>
              <span className={styles.muted}>
                <span className={styles.mono}>{r.reference}</span> · {countryName(r.country)}
              </span>
              <span>
                {formatMoney(r.amount, r.currency)} <span className={styles.muted}>submitted {dateFmt.format(r.submittedAt)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
