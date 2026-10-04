import { CheckCircle, Circle, WarningCircle, XCircle } from "@phosphor-icons/react/ssr";
import type { ApplicationStatus } from "@/db/schema/enums";
import { applicantProgress, type StepState } from "@/lib/application/status";
import { cx } from "@/components/ui/cx";
import styles from "./ProgressTracker.module.css";

const STATE_TEXT: Record<StepState, string> = {
  complete: "Complete",
  current: "In progress",
  upcoming: "Not started",
  attention: "Action needed",
  stopped: "Closed",
};

function StepIcon({ state }: { state: StepState }) {
  switch (state) {
    case "complete":
      return <CheckCircle size={22} weight="fill" />;
    case "attention":
      return <WarningCircle size={22} weight="fill" />;
    case "stopped":
      return <XCircle size={22} weight="fill" />;
    case "current":
      return <span className={styles.pulse} />;
    default:
      return <Circle size={22} />;
  }
}

/** Applicant-facing status steps (done, current, upcoming). */
export function ProgressTracker({ status }: { status: ApplicationStatus }) {
  const steps = applicantProgress(status);
  return (
    <ol className={styles.list}>
      {steps.map((step) => (
        <li key={step.key} className={cx(styles.step, styles[step.state])}>
          <span className={styles.icon} aria-hidden="true">
            <StepIcon state={step.state} />
          </span>
          <span className={styles.label}>
            {step.label}
            <span className="visually-hidden">: {STATE_TEXT[step.state]}</span>
          </span>
          {(step.state === "current" || step.state === "attention") && (
            <span className={styles.tag} aria-hidden="true">
              {STATE_TEXT[step.state]}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
