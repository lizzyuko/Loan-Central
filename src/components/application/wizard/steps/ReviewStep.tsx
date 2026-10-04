"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import { Alert } from "@/components/ui/Feedback";
import { Checkbox } from "@/components/ui/Field";
import { Turnstile, type TurnstileHandle } from "@/components/forms/Turnstile";
import { countryName, getCountry } from "@/config/countries";
import { formatMoney } from "@/config/currencies";
import { EMPLOYMENT_STATUS_LABELS, INCOME_FREQUENCY_LABELS, LOAN_PURPOSES, REPAYMENT_FREQUENCY_LABELS } from "@/config/site";
import { LOAN_DISCLAIMER } from "@/content/legal";
import type { EmploymentStatus, IncomeFrequency, RepaymentFrequency } from "@/db/schema/enums";
import { CONSENT_KEYS, type ConsentKey } from "@/lib/validation/application";
import { StepShell } from "../StepShell";
import { STEPS, type WizardData, type WizardDocumentType, type WizardProduct } from "../types";
import styles from "./ReviewStep.module.css";

interface Props {
  data: WizardData;
  products: WizardProduct[];
  documentTypes: WizardDocumentType[];
  turnstileSiteKey: string;
  submitting: boolean;
  serverError: string | null;
  onEdit: (step: number) => void;
  onBack: () => void;
  onSubmit: (consent: Record<ConsentKey, true>, turnstileToken: string) => void;
  turnstileRef: React.RefObject<TurnstileHandle | null>;
}

function Section({ title, step, onEdit, children }: { title: string; step: number; onEdit: (s: number) => void; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <button type="button" className={styles.edit} onClick={() => onEdit(step)}>
          <PencilSimple size={14} aria-hidden="true" /> Edit<span className="visually-hidden"> {title.toLowerCase()}</span>
        </button>
      </div>
      <dl className={styles.list}>{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>{value || <span className={styles.empty}>Not provided</span>}</dd>
    </div>
  );
}

const CONSENT_LABELS: Record<ConsentKey, ReactNode> = {
  terms: (
    <>
      I agree to the{" "}
      <Link href="/legal/terms" target="_blank">
        Terms of Use
      </Link>
      .
    </>
  ),
  privacy: (
    <>
      I have read the{" "}
      <Link href="/legal/privacy" target="_blank">
        Privacy Policy
      </Link>{" "}
      and agree to my information being used to review this application.
    </>
  ),
  disclosure: (
    <>
      I understand that submitting an application does not guarantee approval or a loan offer (
      <Link href="/legal/disclaimer" target="_blank">
        loan disclosure
      </Link>
      ).
    </>
  ),
  accuracy: <>I confirm the information I&apos;ve provided is accurate and complete.</>,
};

export function ReviewStep({
  data,
  products,
  documentTypes,
  turnstileSiteKey,
  submitting,
  serverError,
  onEdit,
  onBack,
  onSubmit,
  turnstileRef,
}: Props) {
  const [consent, setConsent] = useState<Partial<Record<ConsentKey, boolean>>>({});
  const [token, setToken] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const { loan, personal, address, employment, financial, documents } = data;
  const product = products.find((p) => p.slug === loan?.productSlug);
  const purpose = LOAN_PURPOSES.find((p) => p.value === loan?.purpose)?.label;
  const docLabel = (key: string) => documentTypes.find((t) => t.key === key)?.label ?? key;
  const stepIndex = (key: string) => STEPS.findIndex((s) => s.key === key);

  const allConsented = CONSENT_KEYS.every((k) => consent[k]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!allConsented || !token) {
      setShowErrors(true);
      errorRef.current?.focus();
      return;
    }
    onSubmit(Object.fromEntries(CONSENT_KEYS.map((k) => [k, true])) as Record<ConsentKey, true>, token);
  }

  const phone =
    personal?.phoneCountry && personal.phoneNumber ? `${getCountry(personal.phoneCountry)?.dialCode ?? ""} ${personal.phoneNumber}` : "";

  return (
    <StepShell
      title="Review your application"
      description="Check everything is correct. You can edit any section before submitting."
      onSubmit={submit}
      onBack={onBack}
      submitLabel={submitting ? "Submitting" : "Submit application"}
      submitting={submitting}
    >
      {loan && (
        <Section title="Loan request" step={stepIndex("loan")} onEdit={onEdit}>
          {product && <Row label="Loan type" value={product.name} />}
          <Row label="Purpose" value={purpose} />
          <Row label="Amount" value={formatMoney(loan.amount.replace(/[,\s]/g, ""), loan.currency)} />
          <Row label="Repayment period" value={`${loan.termMonths} months`} />
          <Row label="Repayment frequency" value={REPAYMENT_FREQUENCY_LABELS[loan.repaymentFrequency as RepaymentFrequency]} />
          {loan.purposeDetails && <Row label="Details" value={loan.purposeDetails} />}
        </Section>
      )}

      {personal && (
        <Section title="Personal information" step={stepIndex("personal")} onEdit={onEdit}>
          <Row label="Name" value={[personal.firstName, personal.middleName, personal.lastName].filter(Boolean).join(" ")} />
          <Row label="Date of birth" value={personal.dateOfBirth} />
          <Row label="Email" value={personal.email} />
          <Row label="Phone" value={phone} />
          <Row label="Country of residence" value={countryName(personal.countryOfResidence)} />
          {personal.nationality && <Row label="Nationality" value={countryName(personal.nationality)} />}
        </Section>
      )}

      {address && (
        <Section title="Address" step={stepIndex("address")} onEdit={onEdit}>
          <Row
            label="Address"
            value={[address.line1, address.line2, address.city, address.region, address.postalCode].filter(Boolean).join(", ")}
          />
          <Row label="Country" value={countryName(address.country)} />
        </Section>
      )}

      {employment && (
        <Section title="Employment & income" step={stepIndex("employment")} onEdit={onEdit}>
          <Row label="Status" value={EMPLOYMENT_STATUS_LABELS[employment.employmentStatus as EmploymentStatus]} />
          {employment.employerName && <Row label="Employer / business" value={employment.employerName} />}
          {employment.jobTitle && <Row label="Role / business type" value={employment.jobTitle} />}
          <Row
            label="Income"
            value={`${formatMoney(employment.incomeAmount.replace(/[,\s]/g, ""), employment.incomeCurrency)} ${INCOME_FREQUENCY_LABELS[
              employment.incomeFrequency as IncomeFrequency
            ].toLowerCase()}`}
          />
          {employment.monthsInRole && <Row label="Time in role" value={`${employment.monthsInRole} months`} />}
        </Section>
      )}

      {financial && (
        <Section title="Finances" step={stepIndex("financial")} onEdit={onEdit}>
          <Row label="Existing loans" value={financial.hasExistingLoans === "yes" ? `Yes (${financial.existingLoanCount})` : "No"} />
          <Row label="Monthly debt repayments" value={formatMoney(financial.monthlyDebtPayments.replace(/[,\s]/g, ""), financial.currency)} />
          <Row label="Monthly expenses" value={formatMoney(financial.monthlyExpenses.replace(/[,\s]/g, ""), financial.currency)} />
          {financial.dependents && <Row label="Dependants" value={financial.dependents} />}
          {financial.otherCommitments && <Row label="Other information" value={financial.otherCommitments} />}
        </Section>
      )}

      <Section title="Documents" step={stepIndex("documents")} onEdit={onEdit}>
        {documents.length === 0 ? (
          <Row label="Uploaded" value="" />
        ) : (
          documents.map((d) => <Row key={d.id} label={docLabel(d.documentType)} value={d.filename} />)
        )}
      </Section>

      <div className={styles.consent} ref={errorRef} tabIndex={-1}>
        <h2 className={styles.sectionTitle}>Before you submit</h2>
        <p className={styles.disclaimer}>{LOAN_DISCLAIMER}</p>
        {CONSENT_KEYS.map((key) => (
          <Checkbox
            key={key}
            label={CONSENT_LABELS[key]}
            checked={Boolean(consent[key])}
            onChange={(e) => setConsent((c) => ({ ...c, [key]: e.target.checked }))}
            error={showErrors && !consent[key] ? "Please confirm to continue" : undefined}
          />
        ))}
        <Turnstile ref={turnstileRef} siteKey={turnstileSiteKey} action="apply" onToken={setToken} />
        {showErrors && !token && <p className={styles.tokenError}>Please complete the security check above.</p>}
      </div>

      {serverError && (
        <Alert tone="danger" title="Application submission failed">
          {serverError}
        </Alert>
      )}
    </StepShell>
  );
}
