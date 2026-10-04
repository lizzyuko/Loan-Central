"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { getCountry } from "@/config/countries";
import { Alert } from "@/components/ui/Feedback";
import type { TurnstileHandle } from "@/components/forms/Turnstile";
import type { SubmitApplicationResult } from "@/lib/application/submit-types";
import type { ApplicationSubmissionInput, ConsentKey } from "@/lib/validation/application";
import { WizardProgress } from "./WizardProgress";
import { guessCountry, useWizardState } from "./useWizardState";
import { DEFAULT_REQUIRED_DOCUMENTS, STEPS, type WizardDocumentType, type WizardProduct } from "./types";
import { LoanStep } from "./steps/LoanStep";
import { PersonalStep } from "./steps/PersonalStep";
import { AddressStep } from "./steps/AddressStep";
import { EmploymentStep } from "./steps/EmploymentStep";
import { FinancialStep } from "./steps/FinancialStep";
import { DocumentsStep } from "./steps/DocumentsStep";
import { ReviewStep } from "./steps/ReviewStep";
import { SubmissionSuccess } from "./SubmissionSuccess";
import styles from "./Wizard.module.css";

interface Props {
  products: WizardProduct[];
  documentTypes: WizardDocumentType[];
  initialProductSlug?: string;
  turnstileSiteKey: string;
  submit: (input: ApplicationSubmissionInput) => Promise<SubmitApplicationResult>;
}

export function ApplicationWizard({ products, documentTypes, initialProductSlug, turnstileSiteKey, submit }: Props) {
  const { state, update, goTo, clear, reset, wasRestored } = useWizardState();
  const [submitted, setSubmitted] = useState<{ reference: string; email: string } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();
  const [country] = useState(guessCountry);
  const [showRestored, setShowRestored] = useState(wasRestored);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const furthest = state.furthest;

  // Warn before leaving mid-application (progress is kept for this tab only).
  useEffect(() => {
    const inProgress = !submitted && (state.step > 0 || state.data.loan);
    if (!inProgress) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state, submitted]);

  const data = state.data;
  const product = products.find((p) => p.slug === data.loan?.productSlug);
  const requiredDocs = useMemo(() => {
    const configured = product?.requiredDocumentTypes.length ? product.requiredDocumentTypes : DEFAULT_REQUIRED_DOCUMENTS;
    return configured.filter((k) => documentTypes.some((t) => t.key === k));
  }, [product, documentTypes]);

  if (submitted) {
    return <SubmissionSuccess reference={submitted.reference} email={submitted.email} />;
  }

  const step = state.step;
  const next = () => goTo(Math.min(step + 1, STEPS.length - 1));
  const back = () => goTo(Math.max(step - 1, 0));
  const residence = data.personal?.countryOfResidence || country;
  const countryCurrency = (residence && getCountry(residence)?.defaultCurrency) || "";
  const loanCurrency = data.loan?.currency || countryCurrency || "USD";

  function handleSubmit(consent: Record<ConsentKey, true>, turnstileToken: string, password: string) {
    if (!data.loan || !data.personal || !data.address || !data.employment || !data.financial) {
      setServerError("Some sections are incomplete. Please review each step.");
      return;
    }
    setServerError(null);
    const input: ApplicationSubmissionInput = {
      idempotencyKey: state.idempotencyKey,
      turnstileToken,
      password,
      loan: data.loan,
      personal: data.personal,
      address: data.address,
      employment: data.employment,
      financial: data.financial,
      documents: { documentIds: data.documents.map((d) => d.id) },
      consent,
    };
    startSubmit(async () => {
      try {
        const result = await submit(input);
        if (result.ok) {
          clear();
          setSubmitted({ reference: result.reference, email: result.email });
          window.scrollTo({ top: 0 });
          return;
        }
        setServerError(result.error);
        if (result.resetTurnstile) turnstileRef.current?.reset();
        if (result.step && result.step !== "review") {
          goTo(STEPS.findIndex((s) => s.key === result.step));
        }
      } catch {
        setServerError("Something went wrong while submitting. Please check your connection and try again.");
        turnstileRef.current?.reset();
      }
    });
  }

  const loanDefaults = data.loan ?? (initialProductSlug ? { productSlug: initialProductSlug } : undefined);

  return (
    <div className={`container ${styles.layout}`}>
      <WizardProgress current={step} furthest={furthest} onSelect={goTo} />
      <div className={styles.main}>
        {showRestored && step > 0 && (
          <Alert tone="info" title="Welcome back" className={styles.restored}>
            We restored the progress you saved in this browser.
            <span className={styles.restoredActions}>
              <button type="button" className={styles.linkButton} onClick={() => setShowRestored(false)}>
                Continue
              </button>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => {
                  reset();
                  setShowRestored(false);
                }}
              >
                Start over
              </button>
            </span>
          </Alert>
        )}

        {step === 0 && (
          <LoanStep
            key="loan"
            products={products}
            defaultValues={loanDefaults}
            defaultCurrency={loanCurrency}
            onNext={(loan) => update({ loan }, 1)}
          />
        )}
        {step === 1 && (
          <PersonalStep key="personal" defaultValues={data.personal} defaultCountry={country} onNext={(personal) => update({ personal }, 2)} onBack={back} />
        )}
        {step === 2 && (
          <AddressStep
            key="address"
            defaultValues={data.address}
            defaultCountry={data.personal?.countryOfResidence ?? country}
            onNext={(address) => update({ address }, 3)}
            onBack={back}
          />
        )}
        {step === 3 && (
          <EmploymentStep
            key="employment"
            defaultValues={data.employment}
            defaultCurrency={countryCurrency || loanCurrency}
            onNext={(employment) => update({ employment }, 4)}
            onBack={back}
          />
        )}
        {step === 4 && (
          <FinancialStep
            key="financial"
            defaultValues={data.financial}
            defaultCurrency={data.employment?.incomeCurrency || loanCurrency}
            onNext={(financial) => update({ financial }, 5)}
            onBack={back}
          />
        )}
        {step === 5 && (
          <DocumentsStep
            key="documents"
            documents={data.documents}
            requiredTypes={requiredDocs}
            documentTypes={documentTypes}
            onChange={(documents) => update({ documents })}
            onNext={next}
            onBack={back}
          />
        )}
        {step === 6 && (
          <ReviewStep
            key="review"
            data={data}
            products={products}
            documentTypes={documentTypes}
            turnstileSiteKey={turnstileSiteKey}
            submitting={isSubmitting}
            serverError={serverError}
            onEdit={goTo}
            onBack={back}
            onSubmit={handleSubmit}
            turnstileRef={turnstileRef}
          />
        )}
      </div>
    </div>
  );
}
