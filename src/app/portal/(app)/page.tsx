import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react/ssr";
import { StatusBadge } from "@/components/application/StatusBadge";
import { EmptyState } from "@/components/ui/Feedback";
import { LinkButton } from "@/components/ui/Button";
import { formatMoney } from "@/config/currencies";
import { requireApplicantPage } from "@/lib/auth/applicant";
import { listApplicantApplications } from "@/lib/portal/service";
import styles from "./portal.module.css";

export const metadata: Metadata = { title: "Your applications" };

export default async function PortalHome() {
  const applicant = await requireApplicantPage();
  const apps = await listApplicantApplications(applicant.id);
  if (apps.length === 1) redirect(`/portal/applications/${apps[0]!.id}`);

  return (
    <>
      <div>
        <h1 className={styles.title}>Hello, {applicant.firstName}</h1>
        <p className={styles.subtitle}>Here are your Loan Central applications.</p>
      </div>
      {apps.length === 0 ? (
        <EmptyState title="No applications yet" action={<LinkButton href="/apply">Start an application</LinkButton>} />
      ) : (
        <ul className={styles.list}>
          {apps.map((a) => (
            <li key={a.id}>
              <Link href={`/portal/applications/${a.id}`} className={styles.appCard}>
                <div>
                  <p className={styles.ref}>{a.reference}</p>
                  <p className={styles.appName}>
                    {a.productName ?? "Loan application"} · {formatMoney(a.amount, a.currency)}
                  </p>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <StatusBadge status={a.status} />
                  <CaretRight size={16} aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
