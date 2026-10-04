"use client";

import { useState, useTransition, type FormEvent } from "react";
import { CheckCircle, ChatText, Question, Bank, XCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import type { ApplicationStatus } from "@/db/schema/enums";
import { STATUS_LABELS, STATUS_TRANSITIONS, WORKFLOW_ONLY_TARGETS } from "@/lib/application/status";
import {
  changeStatusAction,
  customMessageAction,
  eligibilityAction,
  requestAccountDetailsAction,
  requestInfoAction,
} from "@/app/admin/(console)/applications/[id]/actions";
import styles from "./ReviewActions.module.css";

type Panel = "info" | "message" | "eligible" | "ineligible" | "account" | null;
type Result = { ok: true; message: string; emailStatus?: string } | { ok: false; error: string };

interface Props {
  applicationId: string;
  status: ApplicationStatus;
  canReview: boolean;
  canCommunicate: boolean;
  documentTypes: { key: string; label: string }[];
}

export function ReviewActions({ applicationId, status, canReview, canCommunicate, documentTypes }: Props) {
  const toast = useToast();
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const allowed = STATUS_TRANSITIONS[status];
  const canGo = (s: ApplicationStatus) => allowed.includes(s);
  const genericTargets = allowed.filter((s) => !WORKFLOW_ONLY_TARGETS.includes(s));

  function runAction(fn: () => Promise<Result>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const emailNote = res.emailStatus && res.emailStatus !== "SENT" ? " The email could not be sent; it has been logged." : "";
      toast.show(res.message + emailNote, emailNote ? "error" : "success");
      setPanel(null);
    });
  }

  function onSubmit(e: FormEvent<HTMLFormElement>, kind: Exclude<Panel, null>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const message = String(fd.get("message") ?? "");
    const notify = fd.get("notify") === "on";
    switch (kind) {
      case "info":
        return runAction(() => requestInfoAction({ applicationId, items: fd.getAll("items").map(String), message }));
      case "message":
        return runAction(() => customMessageAction({ applicationId, subject: String(fd.get("subject") ?? ""), message }));
      case "eligible":
        return runAction(() => eligibilityAction({ applicationId, eligible: true, message: message || undefined, notify }));
      case "ineligible":
        return runAction(() => eligibilityAction({ applicationId, eligible: false, message: message || undefined, notify: true }));
      case "account":
        return runAction(() => requestAccountDetailsAction({ applicationId, message: message || undefined }));
    }
  }

  if (!canReview && !canCommunicate) return null;

  const toggle = (p: Panel) => {
    setError(null);
    setPanel((cur) => (cur === p ? null : p));
  };

  return (
    <section className={styles.panel} aria-labelledby="actions-title">
      <h2 id="actions-title" className={styles.title}>
        Actions
      </h2>

      <div className={styles.buttons}>
        {canCommunicate && canGo("MORE_INFORMATION_REQUIRED") && (
          <Button variant="secondary" size="sm" iconLeft={<Question size={16} />} onClick={() => toggle("info")} aria-expanded={panel === "info"}>
            Request more information
          </Button>
        )}
        {canReview && canGo("ELIGIBLE") && (
          <Button variant="secondary" size="sm" iconLeft={<CheckCircle size={16} />} onClick={() => toggle("eligible")} aria-expanded={panel === "eligible"}>
            Mark eligible
          </Button>
        )}
        {canReview && canGo("NOT_ELIGIBLE") && (
          <Button variant="secondary" size="sm" iconLeft={<XCircle size={16} />} onClick={() => toggle("ineligible")} aria-expanded={panel === "ineligible"}>
            Mark not eligible
          </Button>
        )}
        {canReview && canGo("ACCOUNT_DETAILS_REQUESTED") && (
          <Button variant="secondary" size="sm" iconLeft={<Bank size={16} />} onClick={() => toggle("account")} aria-expanded={panel === "account"}>
            Request account details
          </Button>
        )}
        {canCommunicate && (
          <Button variant="secondary" size="sm" iconLeft={<ChatText size={16} />} onClick={() => toggle("message")} aria-expanded={panel === "message"}>
            Send message
          </Button>
        )}
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {panel === "info" && (
        <form className={styles.form} onSubmit={(e) => onSubmit(e, "info")}>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Documents needed</legend>
            {documentTypes.map((t) => (
              <Checkbox key={t.key} name="items" value={t.key} label={t.label} />
            ))}
          </fieldset>
          <Field label="Message to applicant" hint="Explain exactly what you need. Visible to the applicant.">
            {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} name="message" required maxLength={2000} rows={4} />}
          </Field>
          <Button type="submit" size="sm" loading={pending}>
            Send request
          </Button>
        </form>
      )}

      {panel === "eligible" && (
        <form className={styles.form} onSubmit={(e) => onSubmit(e, "eligible")}>
          <Alert tone="info">This records a pre-qualification decision. It is not a loan offer.</Alert>
          <Field label="Message to applicant" optional>
            {({ id }) => <Textarea id={id} name="message" maxLength={2000} rows={3} />}
          </Field>
          <Checkbox name="notify" defaultChecked label="Email the applicant about this update" />
          <Button type="submit" size="sm" loading={pending}>
            Confirm: potentially eligible
          </Button>
        </form>
      )}

      {panel === "ineligible" && (
        <form className={styles.form} onSubmit={(e) => onSubmit(e, "ineligible")}>
          <Alert tone="warning">The applicant will be notified by email.</Alert>
          <Field label="Message to applicant" optional hint="Be clear and respectful. Avoid internal reasoning.">
            {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} name="message" maxLength={2000} rows={3} />}
          </Field>
          <Button type="submit" size="sm" variant="danger" loading={pending}>
            Confirm: not eligible
          </Button>
        </form>
      )}

      {panel === "account" && (
        <form className={styles.form} onSubmit={(e) => onSubmit(e, "account")}>
          <Alert tone="info">The applicant receives a secure invitation to provide account details in their portal. Details are never collected by email.</Alert>
          <Field label="Message to applicant" optional>
            {({ id }) => <Textarea id={id} name="message" maxLength={2000} rows={3} />}
          </Field>
          <Button type="submit" size="sm" loading={pending}>
            Send invitation
          </Button>
        </form>
      )}

      {panel === "message" && (
        <form className={styles.form} onSubmit={(e) => onSubmit(e, "message")}>
          <Field label="Subject">
            {({ id }) => <Input id={id} name="subject" required maxLength={150} defaultValue="A message about your Loan Central application" />}
          </Field>
          <Field label="Message" hint="Do not include sensitive personal or financial information.">
            {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} name="message" required maxLength={5000} rows={5} />}
          </Field>
          <Button type="submit" size="sm" loading={pending}>
            Send email
          </Button>
        </form>
      )}

      {canReview && genericTargets.length > 0 && <StatusChanger applicationId={applicationId} targets={genericTargets} onRun={runAction} pending={pending} />}
    </section>
  );
}

function StatusChanger({
  applicationId,
  targets,
  onRun,
  pending,
}: {
  applicationId: string;
  targets: readonly ApplicationStatus[];
  onRun: (fn: () => Promise<Result>) => void;
  pending: boolean;
}) {
  const [target, setTarget] = useState<string>("");
  const [notify, setNotify] = useState(true);
  return (
    <form
      className={styles.statusForm}
      onSubmit={(e) => {
        e.preventDefault();
        if (target) onRun(() => changeStatusAction({ applicationId, status: target, notify }));
      }}
    >
      <Field label="Change status">
        {({ id }) => (
          <Select
            id={id}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Select a status"
            options={targets.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          />
        )}
      </Field>
      <Checkbox checked={notify} onChange={(e) => setNotify(e.target.checked)} label="Email the applicant" />
      <Button type="submit" size="sm" variant="secondary" disabled={!target} loading={pending}>
        Update status
      </Button>
    </form>
  );
}
