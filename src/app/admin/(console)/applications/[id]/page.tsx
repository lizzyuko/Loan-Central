import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowSquareOut, CheckCircle, Question, WarningCircle } from "@phosphor-icons/react/ssr";
import { AccountDetailsReveal } from "@/components/admin/AccountDetailsReveal";
import { NoteForm } from "@/components/admin/NoteForm";
import { ReviewActions } from "@/components/admin/ReviewActions";
import { LoanSection } from "@/components/admin/LoanSection";
import { getLoanByApplication } from "@/lib/loans/service";
import { StatusBadge } from "@/components/application/StatusBadge";
import { Badge, EmptyState } from "@/components/ui/Feedback";
import { countryName } from "@/config/countries";
import { formatMoney } from "@/config/currencies";
import { EMPLOYMENT_STATUS_LABELS, INCOME_FREQUENCY_LABELS, LOAN_PURPOSES, REPAYMENT_FREQUENCY_LABELS } from "@/config/site";
import { getApplicationDetail } from "@/lib/admin/application-detail";
import { recordApplicationViewed } from "@/lib/admin/review";
import { debtToIncome } from "@/lib/application/income";
import { can, requireAdminPage } from "@/lib/auth/admin";
import { getRequestContext } from "@/lib/security/request";
import { ageOn } from "@/lib/validation/fields";
import styles from "./detail.module.css";

export const metadata: Metadata = { title: "Application" };

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className={styles.rows}>
      {rows.map(([k, v]) => (
        <div key={k} className={styles.row}>
          <dt>{k}</dt>
          <dd>{v ?? <span className={styles.muted}>Not provided</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "John Doe" → "John D." for display in lists/headers. */
function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0]} ${parts[parts.length - 1]![0]}.`;
}

export default async function ApplicationDetailPage({ params }: PageProps<"/admin/applications/[id]">) {
  const admin = await requireAdminPage("applications.view");
  const { id } = await params;
  const detail = await getApplicationDetail(id);
  if (!detail) notFound();

  const ctx = await getRequestContext();
  const [loanDetail] = await Promise.all([getLoanByApplication(detail.application.id), recordApplicationViewed(admin, detail.application.id, ctx.ipHash)]);

  const { application, applicant, loan, address, employment, financial, product } = detail;
  const purpose = LOAN_PURPOSES.find((p) => p.value === loan.purpose)?.label ?? loan.purpose;
  const dti = financial.currency === employment.incomeCurrency ? debtToIncome(financial.monthlyDebtPayments, employment.monthlyIncome) : null;
  const openRequest = detail.informationRequests.find((r) => r.status === "OPEN");
  const lastFulfilled = detail.informationRequests.find((r) => r.status === "FULFILLED");

  return (
    <>
      <Link href="/admin/applications" className={styles.back}>
        <ArrowLeft size={14} aria-hidden="true" /> All applications
      </Link>

      <header className={styles.header}>
        <div>
          <p className={styles.reference}>{application.reference}</p>
          <h1 className={styles.title}>
            {applicant.firstName} {applicant.lastName}
          </h1>
          <p className={styles.meta}>
            {formatMoney(loan.amount, loan.currency)} · {product?.name ?? purpose} · Submitted {dateTime.format(application.submittedAt)}
          </p>
        </div>
        <StatusBadge status={application.status} />
      </header>

      <div className={styles.grid}>
        <div className={styles.mainCol}>
          {loanDetail && <LoanSection detail={loanDetail} canManage={can(admin, "loans.manage")} canVoid={can(admin, "payments.void")} />}

          <Section title="Applicant">
            <Rows
              rows={[
                ["Full name", [applicant.firstName, applicant.middleName, applicant.lastName].filter(Boolean).join(" ")],
                ["Email", <a key="e" href={`mailto:${applicant.email}`}>{applicant.email}</a>],
                ["Phone", applicant.phone],
                ["Date of birth", `${dateOnly.format(new Date(`${applicant.dateOfBirth}T00:00:00Z`))} (age ${ageOn(applicant.dateOfBirth)})`],
                ["Country of residence", countryName(applicant.countryOfResidence)],
                ["Nationality", applicant.nationality ? countryName(applicant.nationality) : null],
                [
                  "Address",
                  <span key="a">
                    {[address.line1, address.line2].filter(Boolean).join(", ")}
                    <br />
                    {[address.city, address.region, address.postalCode].filter(Boolean).join(", ")}
                    <br />
                    {countryName(address.country)}
                  </span>,
                ],
              ]}
            />
          </Section>

          <Section title="Loan request">
            <Rows
              rows={[
                ["Amount", formatMoney(loan.amount, loan.currency)],
                ["Currency", loan.currency],
                ["Product", product?.name ?? "Not selected"],
                ["Purpose", purpose],
                ["Details", loan.purposeDetails],
                ["Requested term", `${loan.termMonths} months`],
                ["Repayment frequency", REPAYMENT_FREQUENCY_LABELS[loan.repaymentFrequency]],
              ]}
            />
          </Section>

          <Section title="Employment & income">
            <Rows
              rows={[
                ["Status", EMPLOYMENT_STATUS_LABELS[employment.employmentStatus]],
                ["Employer / business", employment.employerName],
                ["Role / business type", employment.jobTitle],
                ["Time in role", employment.monthsInRole !== null ? `${employment.monthsInRole} months` : null],
                ["Income", `${formatMoney(employment.incomeAmount, employment.incomeCurrency)} (${INCOME_FREQUENCY_LABELS[employment.incomeFrequency].toLowerCase()})`],
                ["Monthly equivalent", formatMoney(employment.monthlyIncome, employment.incomeCurrency)],
              ]}
            />
          </Section>

          <Section title="Financial profile">
            <Rows
              rows={[
                ["Existing loans", financial.hasExistingLoans ? `Yes (${financial.existingLoanCount ?? "?"})` : "No"],
                ["Monthly debt repayments", formatMoney(financial.monthlyDebtPayments, financial.currency)],
                ["Monthly expenses", formatMoney(financial.monthlyExpenses, financial.currency)],
                ["Debt-to-income", dti !== null ? `${(dti * 100).toFixed(1)}%` : "Not comparable (different currencies)"],
                ["Dependants", financial.dependents !== null ? String(financial.dependents) : null],
                ["Other information", financial.otherCommitments],
              ]}
            />
          </Section>

          <Section title="Documents" aside={<span className={styles.muted}>{detail.documents.length} file(s)</span>}>
            {detail.documents.length === 0 ? (
              <EmptyState title="No documents uploaded" />
            ) : (
              <ul className={styles.docs}>
                {detail.documents.map((d) => (
                  <li key={d.id} className={styles.doc}>
                    <div>
                      <p className={styles.docLabel}>{detail.documentLabels[d.documentType] ?? d.documentType}</p>
                      <p className={styles.muted}>
                        {d.filename} · {Math.max(1, Math.round(d.bytes / 1024))} KB · {dateOnly.format(d.createdAt)}
                        {d.informationRequestId ? " · in response to a request" : ""}
                      </p>
                    </div>
                    {can(admin, "documents.view") && (
                      <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className={styles.docLink}>
                        View <ArrowSquareOut size={14} aria-hidden="true" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {(openRequest || lastFulfilled) && (
            <Section title="Information request">
              {openRequest && (
                <div className={styles.request}>
                  <Badge tone="warning">Awaiting applicant</Badge>
                  <p>{openRequest.message}</p>
                  <p className={styles.muted}>Requested {dateTime.format(openRequest.createdAt)}</p>
                </div>
              )}
              {!openRequest && lastFulfilled && (
                <div className={styles.request}>
                  <Badge tone="success">Applicant responded</Badge>
                  <p className={styles.muted}>Request: {lastFulfilled.message}</p>
                  {lastFulfilled.responseText && <p>&ldquo;{lastFulfilled.responseText}&rdquo;</p>}
                  {lastFulfilled.fulfilledAt && <p className={styles.muted}>Responded {dateTime.format(lastFulfilled.fulfilledAt)}</p>}
                </div>
              )}
            </Section>
          )}

          <Section title="Account details">
            {!detail.accountDetails ? (
              <p className={styles.muted}>
                {application.status === "ACCOUNT_DETAILS_REQUESTED" ? "Requested. Waiting for the applicant." : "Not requested yet."}
              </p>
            ) : detail.accountDetails.purgedAt ? (
              <p className={styles.muted}>Deleted under the retention policy on {dateOnly.format(detail.accountDetails.purgedAt)}.</p>
            ) : (
              <>
                <Rows
                  rows={[
                    ["Account holder", maskName(detail.accountDetails.accountHolderName)],
                    ["Bank", detail.accountDetails.bankName],
                    [detail.accountDetails.maskedIdentifierType, <span key="m" className={styles.mono}>{detail.accountDetails.maskedIdentifier}</span>],
                    ["Country", countryName(detail.accountDetails.country)],
                    ["Currency", detail.accountDetails.currency],
                    ["Submitted", dateTime.format(detail.accountDetails.submittedAt)],
                  ]}
                />
                {can(admin, "account_details.reveal") && <AccountDetailsReveal applicationId={application.id} />}
              </>
            )}
          </Section>

          <Section title="Communications">
            {detail.communications.length === 0 ? (
              <p className={styles.muted}>No messages yet.</p>
            ) : (
              <ul className={styles.comms}>
                {detail.communications.map((c) => (
                  <li key={c.id} className={styles.comm}>
                    <div className={styles.commHead}>
                      <strong>{c.subject}</strong>
                      <Badge tone={c.deliveryStatus === "SENT" ? "success" : c.deliveryStatus === "FAILED" ? "danger" : "neutral"}>
                        {c.deliveryStatus.toLowerCase()}
                      </Badge>
                    </div>
                    <p className={styles.muted}>
                      {c.senderName ? `${c.senderName} → ` : "System → "}
                      {c.recipientEmail} · {dateTime.format(c.createdAt)}
                    </p>
                    {c.body && <p className={styles.commBody}>{c.body}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <aside className={styles.sideCol}>
          <ReviewActions
            applicationId={application.id}
            status={application.status}
            canReview={can(admin, "applications.review")}
            canCommunicate={can(admin, "communications.send")}
            documentTypes={Object.entries(detail.documentLabels).map(([key, label]) => ({ key, label }))}
            canManageLoans={can(admin, "loans.manage")}
            loanDefaults={{ principal: loan.amount, currency: loan.currency, termMonths: loan.termMonths, frequency: loan.repaymentFrequency }}
          />

          <section className={styles.sidePanel}>
            <h2 className={styles.sectionTitle}>Review indicators</h2>
            <p className={styles.small}>Advisory only. You make the decision.</p>
            <ul className={styles.indicators}>
              {detail.indicators.map((i) => (
                <li key={i.key} className={styles.indicator} data-status={i.status}>
                  {i.status === "pass" ? (
                    <CheckCircle size={18} weight="fill" aria-hidden="true" />
                  ) : i.status === "flag" ? (
                    <WarningCircle size={18} weight="fill" aria-hidden="true" />
                  ) : (
                    <Question size={18} aria-hidden="true" />
                  )}
                  <div>
                    <p className={styles.indicatorLabel}>
                      {i.label}
                      <span className="visually-hidden">: {i.status === "pass" ? "within guideline" : i.status === "flag" ? "needs attention" : "unknown"}</span>
                    </p>
                    <p className={styles.small}>{i.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.sidePanel}>
            <h2 className={styles.sectionTitle}>Private notes</h2>
            {can(admin, "notes.create") && <NoteForm applicationId={application.id} />}
            <ul className={styles.notes}>
              {detail.notes.map((n) => (
                <li key={n.id} className={styles.note}>
                  <p className={styles.noteBody}>{n.body}</p>
                  <p className={styles.small}>
                    {n.authorName ?? "Former admin"} · {dateTime.format(n.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.sidePanel}>
            <h2 className={styles.sectionTitle}>Timeline</h2>
            <ol className={styles.timeline}>
              {detail.events.map((e) => (
                <li key={e.id} className={styles.event}>
                  <p className={styles.eventSummary}>{e.summary}</p>
                  <p className={styles.small}>
                    {e.actorName ?? (e.actorType === "APPLICANT" ? "Applicant" : "System")} · {dateTime.format(e.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}
