import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle } from "@phosphor-icons/react/ssr";
import { StatusBadge } from "@/components/application/StatusBadge";
import { AccountDetailsForm } from "@/components/portal/AccountDetailsForm";
import { InfoRequestResponse } from "@/components/portal/InfoRequestResponse";
import { ProgressTracker } from "@/components/portal/ProgressTracker";
import { Alert } from "@/components/ui/Feedback";
import { getCountry } from "@/config/countries";
import { formatMoney } from "@/config/currencies";
import { LOAN_PURPOSES } from "@/config/site";
import { LOAN_DISCLAIMER } from "@/content/legal";
import { APPLICANT_STATUS_COPY } from "@/lib/application/status";
import { requireApplicantPage } from "@/lib/auth/applicant";
import { getPortalApplication, listApplicantApplications } from "@/lib/portal/service";
import { getDb } from "@/db";
import { applicants } from "@/db/schema";
import { eq } from "drizzle-orm";
import styles from "../../portal.module.css";

export const metadata: Metadata = { title: "Application status" };

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function PortalApplicationPage({ params }: PageProps<"/portal/applications/[id]">) {
  const applicant = await requireApplicantPage();
  const { id } = await params;
  const app = await getPortalApplication(applicant.id, id);
  if (!app) notFound();

  const others = (await listApplicantApplications(applicant.id)).length > 1;
  const purpose = LOAN_PURPOSES.find((p) => p.value === app.purpose)?.label ?? app.purpose;

  let residence = "";
  if (app.status === "ACCOUNT_DETAILS_REQUESTED") {
    const [row] = await getDb().select({ c: applicants.countryOfResidence }).from(applicants).where(eq(applicants.id, applicant.id));
    residence = row?.c ?? "";
  }

  return (
    <>
      {others && (
        <Link href="/portal" className={styles.back}>
          <ArrowLeft size={14} aria-hidden="true" /> All applications
        </Link>
      )}

      <section className={styles.card} aria-labelledby="status-title">
        <div className={styles.statusHead}>
          <div>
            <p className={styles.ref}>{app.reference}</p>
            <h1 id="status-title" className={styles.title}>
              Application status
            </h1>
          </div>
          <StatusBadge status={app.status} />
        </div>
        <p className={styles.statusCopy}>{APPLICANT_STATUS_COPY[app.status]}</p>
        <ProgressTracker status={app.status} />
      </section>

      {app.openRequest && (
        <section className={styles.card} aria-labelledby="request-title">
          <h2 id="request-title" className={styles.cardTitle}>
            Information requested
          </h2>
          <InfoRequestResponse
            applicationId={app.id}
            request={app.openRequest}
            documentTypes={app.documentTypes}
            existing={app.documents
              .filter((d) => d.informationRequestId === app.openRequest!.id)
              .map((d) => ({ id: d.id, documentType: d.documentType, filename: d.filename, bytes: d.bytes }))}
          />
        </section>
      )}

      {app.status === "ACCOUNT_DETAILS_REQUESTED" && (
        <section className={styles.card} aria-labelledby="account-title">
          <h2 id="account-title" className={styles.cardTitle}>
            Account information
          </h2>
          <AccountDetailsForm applicationId={app.id} defaultCountry={residence} defaultCurrency={(residence && getCountry(residence)?.defaultCurrency) || app.currency} />
        </section>
      )}

      {app.accountSummary && app.status !== "ACCOUNT_DETAILS_REQUESTED" && (
        <Alert tone="success" title="Account details received">
          <CheckCircle size={14} aria-hidden="true" /> {app.accountSummary.bankName}, account {app.accountSummary.maskedIdentifier}. Received {dateTime.format(app.accountSummary.submittedAt)}.
        </Alert>
      )}

      <section className={styles.card} aria-labelledby="summary-title">
        <h2 id="summary-title" className={styles.cardTitle}>
          Your request
        </h2>
        <dl className={styles.summary}>
          <div>
            <dt>Amount</dt>
            <dd>{formatMoney(app.amount, app.currency)}</dd>
          </div>
          <div>
            <dt>Loan type</dt>
            <dd>{app.productName ?? purpose}</dd>
          </div>
          <div>
            <dt>Term</dt>
            <dd>{app.termMonths} months</dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>{dateTime.format(app.submittedAt)}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.card} aria-labelledby="messages-title">
        <h2 id="messages-title" className={styles.cardTitle}>
          Messages
        </h2>
        {app.messages.length === 0 ? (
          <p className={styles.muted}>Messages from our team will appear here.</p>
        ) : (
          <ul className={styles.messages}>
            {app.messages.map((m) => (
              <li key={m.id} className={styles.message}>
                <p className={styles.messageSubject}>{m.subject}</p>
                <p className={styles.muted}>{dateTime.format(m.createdAt)}</p>
                {m.body && <p className={styles.messageBody}>{m.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className={styles.muted}>{LOAN_DISCLAIMER}</p>
    </>
  );
}
