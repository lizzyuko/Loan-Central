import type { ApplicationStatus } from "@/db/schema/enums";

/**
 * Application lifecycle. The server is the only authority on transitions;
 * this table is enforced in every status-changing action.
 */
export const STATUS_TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "MORE_INFORMATION_REQUIRED", "ELIGIBLE", "NOT_ELIGIBLE"],
  UNDER_REVIEW: ["MORE_INFORMATION_REQUIRED", "ELIGIBLE", "NOT_ELIGIBLE"],
  MORE_INFORMATION_REQUIRED: ["UNDER_REVIEW", "ELIGIBLE", "NOT_ELIGIBLE"],
  ELIGIBLE: ["ACCOUNT_DETAILS_REQUESTED", "UNDER_REVIEW", "NOT_ELIGIBLE"],
  NOT_ELIGIBLE: ["UNDER_REVIEW"],
  ACCOUNT_DETAILS_REQUESTED: ["FINAL_REVIEW", "UNDER_REVIEW"],
  FINAL_REVIEW: ["COMPLETED", "ACCOUNT_DETAILS_REQUESTED", "NOT_ELIGIBLE"],
  COMPLETED: [],
};

/**
 * Transitions that must go through a dedicated workflow action (which sends
 * the right email / creates the right records) rather than the generic
 * "change status" control.
 */
export const WORKFLOW_ONLY_TARGETS: readonly ApplicationStatus[] = [
  "MORE_INFORMATION_REQUIRED",
  "ELIGIBLE",
  "NOT_ELIGIBLE",
  "ACCOUNT_DETAILS_REQUESTED",
];

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(from: ApplicationStatus, to: ApplicationStatus) {
    super(`Cannot change status from ${from} to ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: ApplicationStatus, to: ApplicationStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  MORE_INFORMATION_REQUIRED: "Information required",
  ELIGIBLE: "Potentially eligible",
  NOT_ELIGIBLE: "Not eligible",
  ACCOUNT_DETAILS_REQUESTED: "Account details requested",
  FINAL_REVIEW: "Final review",
  COMPLETED: "Completed",
};

export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger";

export const STATUS_TONES: Record<ApplicationStatus, StatusTone> = {
  SUBMITTED: "neutral",
  UNDER_REVIEW: "info",
  MORE_INFORMATION_REQUIRED: "warning",
  ELIGIBLE: "success",
  NOT_ELIGIBLE: "danger",
  ACCOUNT_DETAILS_REQUESTED: "info",
  FINAL_REVIEW: "info",
  COMPLETED: "success",
};

// --- Applicant-facing progress tracker ---------------------------------------

export type StepState = "complete" | "current" | "upcoming" | "attention" | "stopped";

export interface ProgressStep {
  key: string;
  label: string;
  state: StepState;
}

const STEP_LABELS = [
  ["submitted", "Application submitted"],
  ["initial", "Initial review"],
  ["eligibility", "Eligibility review"],
  ["account", "Account information"],
  ["final", "Final review"],
] as const;

/** Index of the step currently in progress for each status. */
const CURRENT_STEP: Record<ApplicationStatus, number> = {
  SUBMITTED: 1,
  UNDER_REVIEW: 1,
  MORE_INFORMATION_REQUIRED: 1,
  ELIGIBLE: 2,
  NOT_ELIGIBLE: 2,
  ACCOUNT_DETAILS_REQUESTED: 3,
  FINAL_REVIEW: 4,
  COMPLETED: 5,
};

export function applicantProgress(status: ApplicationStatus): ProgressStep[] {
  const current = CURRENT_STEP[status];
  return STEP_LABELS.map(([key, label], i) => {
    let state: StepState = i < current ? "complete" : i === current ? "current" : "upcoming";
    if (i === current && status === "MORE_INFORMATION_REQUIRED") state = "attention";
    if (status === "NOT_ELIGIBLE" && i === current) state = "stopped";
    if (status === "ELIGIBLE" && i === 2) state = "complete";
    return { key, label, state };
  });
}

/** Plain-language status explanation for applicants (no internal detail). */
export const APPLICANT_STATUS_COPY: Record<ApplicationStatus, string> = {
  SUBMITTED: "We've received your application. A member of our team will begin reviewing it soon.",
  UNDER_REVIEW: "Our team is reviewing your application. We'll email you when there's an update.",
  MORE_INFORMATION_REQUIRED: "We need a little more information to continue reviewing your application. Please see the request below.",
  ELIGIBLE: "Good news. Based on our initial review, you may be eligible. We'll be in touch about next steps. This is not a loan offer.",
  NOT_ELIGIBLE: "After careful review, we're unable to move forward with this application at this time.",
  ACCOUNT_DETAILS_REQUESTED: "Your application has progressed to the next stage. Please provide the requested account information.",
  FINAL_REVIEW: "Thank you. Your application is in final review. We'll contact you with the outcome.",
  COMPLETED: "Your application process is complete. Thank you for choosing Loan Central.",
};
