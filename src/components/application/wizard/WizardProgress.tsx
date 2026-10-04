"use client";

import { Check } from "@phosphor-icons/react";
import { cx } from "@/components/ui/cx";
import { STEPS } from "./types";
import styles from "./Wizard.module.css";

interface Props {
  current: number;
  /** Highest step the user has reached (completed steps are clickable). */
  furthest: number;
  onSelect: (step: number) => void;
}

export function WizardProgress({ current, furthest, onSelect }: Props) {
  const pct = Math.round((current / (STEPS.length - 1)) * 100);
  const currentStep = STEPS[current];
  return (
    <nav className={styles.progress} aria-label="Application progress">
      <div className={styles.progressMobile}>
        <p className={styles.progressLabel}>
          Step {current + 1} of {STEPS.length}
          <span className={styles.progressStepName}>{currentStep?.title}</span>
        </p>
        <div
          className={styles.progressBar}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Progress"
        >
          <span style={{ width: `${Math.max(pct, 4)}%` }} />
        </div>
      </div>
      <ol className={styles.progressList}>
        {STEPS.map((step, i) => {
          const done = i < current || (i <= furthest && i !== current);
          const reachable = i <= furthest && i !== current;
          return (
            <li key={step.key} className={cx(styles.progressItem, i === current && styles.progressCurrent, done && styles.progressDone)}>
              <button
                type="button"
                className={styles.progressButton}
                onClick={() => onSelect(i)}
                disabled={!reachable}
                aria-current={i === current ? "step" : undefined}
              >
                <span className={styles.progressDot} aria-hidden="true">
                  {done ? <Check size={12} weight="bold" /> : i + 1}
                </span>
                <span className={styles.progressText}>{step.short}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
