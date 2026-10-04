"use client";

import { useEffect, useRef, type FormEventHandler, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import styles from "./Wizard.module.css";

interface StepShellProps {
  title: string;
  description?: ReactNode;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onBack?: () => void;
  submitLabel?: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

/** Frame for one wizard step: heading, form body and Back / Continue. */
export function StepShell({
  title,
  description,
  onSubmit,
  onBack,
  submitLabel = "Continue",
  submitting,
  submitDisabled,
  children,
  footer,
}: StepShellProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the step heading so screen-reader users hear the new step.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <form className={styles.step} onSubmit={onSubmit} noValidate>
      <div className={styles.stepHeader}>
        <h1 ref={headingRef} tabIndex={-1} className={styles.stepTitle}>
          {title}
        </h1>
        {description && <p className={styles.stepDescription}>{description}</p>}
      </div>
      <div className={styles.stepBody}>{children}</div>
      {footer}
      <div className={styles.actions}>
        {onBack ? (
          <Button variant="ghost" onClick={onBack} iconLeft={<ArrowLeft size={16} />} disabled={submitting}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="submit"
          size="lg"
          loading={submitting}
          disabled={submitDisabled}
          iconRight={submitting ? undefined : <ArrowRight size={18} weight="bold" />}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
