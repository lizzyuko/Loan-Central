"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert, Badge } from "@/components/ui/Feedback";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { currencyOptions, formatMoney } from "@/config/currencies";
import { REPAYMENT_FREQUENCY_LABELS } from "@/config/site";
import { REPAYMENT_FREQUENCIES, type RepaymentFrequency } from "@/db/schema/enums";
import { buildFlatSchedule, toIsoDate } from "@/lib/loans/schedule";
import { PAYMENT_METHODS } from "@/lib/validation/loans";
import { approveLoanAction, disburseLoanAction, recordPaymentAction, voidPaymentAction } from "@/app/admin/(console)/loans/actions";
import { saveLoanSettingsAction } from "@/app/admin/(console)/settings/actions";
import styles from "./LoanForms.module.css";

type Result = { ok: true; message: string; emailStatus?: string } | { ok: false; error: string };

function useAction() {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(fn: () => Promise<Result>, onDone?: () => void) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error);
      const emailFailed = "emailStatus" in res && res.emailStatus && res.emailStatus !== "SENT";
      toast.show(res.message + (emailFailed ? " The email could not be sent; it has been logged." : ""), emailFailed ? "error" : "success");
      onDone?.();
      router.refresh();
    });
  }
  return { run, pending, error };
}

const today = () => toIsoDate(new Date());
function addMonths(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return toIsoDate(d);
}

// --- Approve -------------------------------------------------------------------------

export function ApproveLoanForm({
  applicationId,
  defaults,
  onDone,
}: {
  applicationId: string;
  defaults: { principal: string; currency: string; termMonths: number; frequency: RepaymentFrequency };
  onDone?: () => void;
}) {
  const { run, pending, error } = useAction();
  const [principal, setPrincipal] = useState(defaults.principal);
  const [currency, setCurrency] = useState(defaults.currency);
  const [rate, setRate] = useState("");
  const [term, setTerm] = useState(String(defaults.termMonths));
  const [frequency, setFrequency] = useState<RepaymentFrequency>(defaults.frequency);
  const [firstDue, setFirstDue] = useState(addMonths(today(), 1));
  const [message, setMessage] = useState("");
  const [notify, setNotify] = useState(true);
  const currencies = useMemo(() => currencyOptions(), []);

  const preview = useMemo(() => {
    try {
      if (rate === "" || !firstDue) return null;
      return buildFlatSchedule({ principal: principal.replace(/[,\s]/g, ""), annualRatePct: Number(rate), termMonths: Number(term), frequency, firstDueDate: firstDue });
    } catch {
      return null;
    }
  }, [principal, rate, term, frequency, firstDue]);
  const money = (v: string) => formatMoney(v, currency);

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => approveLoanAction({ applicationId, principal, currency, annualRatePct: rate, termMonths: term, frequency, firstDueDate: firstDue, message, notify }),
          onDone,
        );
      }}
    >
      <Alert tone="info">Approving creates the loan and its repayment schedule. Interest is a flat rate per year on the approved amount.</Alert>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className={styles.grid}>
        <Field label="Approved amount">{({ id }) => <Input id={id} inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} required />}</Field>
        <Field label="Currency">{({ id }) => <Select id={id} value={currency} onChange={(e) => setCurrency(e.target.value)} options={currencies} />}</Field>
        <Field label="Flat interest rate (% per year)">{({ id }) => <Input id={id} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 12" required />}</Field>
        <Field label="Term (months)">{({ id }) => <Input id={id} inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value)} required />}</Field>
        <Field label="Repayment frequency">
          {({ id }) => (
            <Select id={id} value={frequency} onChange={(e) => setFrequency(e.target.value as RepaymentFrequency)} options={REPAYMENT_FREQUENCIES.map((f) => ({ value: f, label: REPAYMENT_FREQUENCY_LABELS[f] }))} />
          )}
        </Field>
        <Field label="First payment due">{({ id }) => <Input id={id} type="date" min={today()} value={firstDue} onChange={(e) => setFirstDue(e.target.value)} required />}</Field>
      </div>

      {preview && (
        <dl className={styles.preview}>
          <div>
            <dt>Total interest</dt>
            <dd>{money(preview.totalInterest)}</dd>
          </div>
          <div>
            <dt>Total repayable</dt>
            <dd>{money(preview.totalRepayable)}</dd>
          </div>
          <div>
            <dt>Instalments</dt>
            <dd>
              {preview.installmentCount} × {money(preview.regularInstallment)}
            </dd>
          </div>
          <div>
            <dt>Final payment</dt>
            <dd>{preview.installments.at(-1)?.dueDate}</dd>
          </div>
        </dl>
      )}

      <Field label="Message to applicant" optional>
        {({ id }) => <Textarea id={id} rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />}
      </Field>
      <Checkbox checked={notify} onChange={(e) => setNotify(e.target.checked)} label="Email the applicant their approval and schedule" />
      <div>
        <Button type="submit" loading={pending} disabled={!preview}>
          Approve loan
        </Button>
      </div>
    </form>
  );
}

// --- Loan panel actions -----------------------------------------------------------------

export function DisburseForm({ loanId }: { loanId: string }) {
  const { run, pending, error } = useAction();
  const [date, setDate] = useState(today());
  return (
    <form
      className={styles.inline}
      onSubmit={(e) => {
        e.preventDefault();
        run(() => disburseLoanAction({ loanId, disbursedOn: date }));
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Disbursed on">{({ id }) => <Input id={id} type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
      <Button type="submit" loading={pending}>
        Mark as disbursed
      </Button>
    </form>
  );
}

export function RecordPaymentForm({ loanId, currency, suggested }: { loanId: string; currency: string; suggested: string | null }) {
  const { run, pending, error } = useAction();
  const [amount, setAmount] = useState(suggested ?? "");
  const [paidOn, setPaidOn] = useState(today());
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => recordPaymentAction({ loanId, amount, paidOn, method, reference, note, notify }),
          () => {
            setReference("");
            setNote("");
          },
        );
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <div className={styles.grid}>
        <Field label={`Amount (${currency})`}>{({ id }) => <Input id={id} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />}</Field>
        <Field label="Paid on">{({ id }) => <Input id={id} type="date" max={today()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required />}</Field>
        <Field label="Method">{({ id }) => <Select id={id} value={method} onChange={(e) => setMethod(e.target.value)} options={PAYMENT_METHODS} />}</Field>
        <Field label="Reference" optional>
          {({ id }) => <Input id={id} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} placeholder="Transaction ID" />}
        </Field>
      </div>
      <Field label="Internal note" optional hint="Not shown to the applicant.">
        {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />}
      </Field>
      <Checkbox checked={notify} onChange={(e) => setNotify(e.target.checked)} label="Email the applicant a receipt" />
      <div>
        <Button type="submit" loading={pending}>
          Record payment
        </Button>
      </div>
    </form>
  );
}

export function VoidPaymentButton({ paymentId }: { paymentId: string }) {
  const { run, pending, error } = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Void
      </Button>
    );
  }
  return (
    <form
      className={styles.inline}
      onSubmit={(e) => {
        e.preventDefault();
        run(() => voidPaymentAction({ paymentId, reason }));
      }}
    >
      {error && <Badge tone="danger">{error}</Badge>}
      <Input aria-label="Reason for voiding" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" maxLength={300} />
      <Button type="submit" size="sm" variant="danger" loading={pending}>
        Confirm void
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}

// --- Settings --------------------------------------------------------------------------------

export function LoanSettingsForm({ initial }: { initial: string }) {
  const { run, pending, error } = useAction();
  const [value, setValue] = useState(initial);
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveLoanSettingsAction({ repaymentInstructions: value }));
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Repayment instructions" hint="For example: bank name, account name and number, mobile money number, and the reference applicants should use (their application reference).">
        {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} rows={8} maxLength={2000} value={value} onChange={(e) => setValue(e.target.value)} />}
      </Field>
      <div>
        <Button type="submit" loading={pending}>
          Save loan settings
        </Button>
      </div>
    </form>
  );
}
