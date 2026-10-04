"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert, Badge } from "@/components/ui/Feedback";
import { Checkbox, Field, Input, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { clearProviderAction, saveEmailSettingsAction, testEmailAction } from "@/app/admin/(console)/settings/actions";
import type { EmailProvider, EmailSettingsView } from "@/lib/email/settings";
import styles from "./settings.module.css";

type Result = { ok: true; message: string } | { ok: false; error: string };

interface Props {
  view: EmailSettingsView;
  zohoHosts: ReadonlyArray<{ value: string; label: string }>;
  envFallback: boolean;
}

export function EmailSettingsForm({ view, zohoHosts, envFallback }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<EmailProvider | "">(view.activeProvider ?? "");
  const [fallback, setFallback] = useState(view.fallbackEnabled);
  const [replyTo, setReplyTo] = useState(view.replyTo);
  const [resendFrom, setResendFrom] = useState(view.resend.from);
  const [resendApiKey, setResendApiKey] = useState("");
  const [zohoHost, setZohoHost] = useState(view.zoho.host);
  const [zohoPort, setZohoPort] = useState(String(view.zoho.port));
  const [zohoUser, setZohoUser] = useState(view.zoho.user);
  const [zohoFrom, setZohoFrom] = useState(view.zoho.from);
  const [zohoPassword, setZohoPassword] = useState("");

  function run(fn: () => Promise<Result>, after?: () => void) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error);
      toast.show(res.message, "success");
      after?.();
      router.refresh();
    });
  }

  function save() {
    run(
      () =>
        saveEmailSettingsAction({
          activeProvider: active || null,
          fallbackEnabled: fallback,
          replyTo,
          resendFrom,
          resendApiKey,
          zohoHost,
          zohoPort: Number(zohoPort),
          zohoUser,
          zohoFrom,
          zohoPassword,
        }),
      () => {
        setResendApiKey("");
        setZohoPassword("");
      },
    );
  }

  return (
    <div className={styles.stack}>
      {error && <Alert tone="danger">{error}</Alert>}
      {!view.activeProvider && (
        <Alert tone={envFallback ? "info" : "warning"} title="No provider selected">
          {envFallback
            ? "Emails are currently sent with the Resend settings from your environment variables. Configure a provider below to manage email from here."
            : "Emails can't be sent until you configure and select a provider below."}
        </Alert>
      )}

      <section className={styles.providerCard}>
        <h2 className={styles.cardTitle}>Sending</h2>
        <fieldset className={styles.radioRow}>
          <legend className="visually-hidden">Active provider</legend>
          {(
            [
              ["", "None"],
              ["resend", "Resend"],
              ["zoho", "Zoho Mail (SMTP)"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className={styles.radioOption}>
              <input type="radio" name="activeProvider" value={value} checked={active === value} onChange={() => setActive(value)} />
              {label}
            </label>
          ))}
        </fieldset>
        <Checkbox
          checked={fallback}
          onChange={(e) => setFallback(e.target.checked)}
          label="If the selected provider fails, retry with the other one (when both are configured)"
        />
        <Field label="Reply-to address" optional hint="Where applicant replies go. Leave blank to use the from address.">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} />}
        </Field>
      </section>

      <section className={styles.providerCard}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>Resend</h2>
          {view.resend.configured ? <Badge tone="success">Configured</Badge> : <Badge>Not configured</Badge>}
        </div>
        <div className={styles.grid2}>
          <Field label="From address" hint="Must be on a domain verified in Resend, e.g. Loan Central <noreply@yourdomain.com>">
            {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={resendFrom} onChange={(e) => setResendFrom(e.target.value)} />}
          </Field>
          <Field label="API key" hint={view.resend.apiKeyHint ? `Saved key ${view.resend.apiKeyHint}. Leave blank to keep it.` : "Starts with re_"}>
            {({ id, describedBy }) => (
              <Input id={id} aria-describedby={describedBy} type="password" autoComplete="off" value={resendApiKey} onChange={(e) => setResendApiKey(e.target.value)} placeholder={view.resend.apiKeyHint ?? "re_..."} />
            )}
          </Field>
        </div>
        <div className={styles.inlineRow}>
          <Button size="sm" variant="secondary" disabled={!view.resend.configured || pending} onClick={() => run(() => testEmailAction({ provider: "resend" }))}>
            Send test email
          </Button>
          {view.resend.configured && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => clearProviderAction({ provider: "resend" }))}>
              Remove key
            </Button>
          )}
        </div>
      </section>

      <section className={styles.providerCard}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>Zoho Mail (SMTP)</h2>
          {view.zoho.configured ? <Badge tone="success">Configured</Badge> : <Badge>Not configured</Badge>}
        </div>
        <p className={styles.help}>
          In Zoho, create an app-specific password (Zoho Accounts → Security → App passwords) and use it here, not your normal login password.
          The from address must be your Zoho mailbox or one of its verified aliases.
        </p>
        <div className={styles.grid2}>
          <Field label="SMTP server">
            {({ id }) => <Select id={id} value={zohoHost} onChange={(e) => setZohoHost(e.target.value)} options={zohoHosts} />}
          </Field>
          <Field label="Port">
            {({ id }) => (
              <Select
                id={id}
                value={zohoPort}
                onChange={(e) => setZohoPort(e.target.value)}
                options={[
                  { value: "465", label: "465 (SSL), recommended" },
                  { value: "587", label: "587 (STARTTLS)" },
                ]}
              />
            )}
          </Field>
          <Field label="Username" hint="Your full Zoho email address">
            {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} type="email" autoComplete="off" value={zohoUser} onChange={(e) => setZohoUser(e.target.value)} />}
          </Field>
          <Field label="App password" hint={view.zoho.passwordHint ? `Saved password ${view.zoho.passwordHint}. Leave blank to keep it.` : undefined}>
            {({ id, describedBy }) => (
              <Input id={id} aria-describedby={describedBy} type="password" autoComplete="new-password" value={zohoPassword} onChange={(e) => setZohoPassword(e.target.value)} placeholder={view.zoho.passwordHint ?? ""} />
            )}
          </Field>
          <Field label="From address" hint="e.g. Loan Central <noreply@yourdomain.com>">
            {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={zohoFrom} onChange={(e) => setZohoFrom(e.target.value)} />}
          </Field>
        </div>
        <div className={styles.inlineRow}>
          <Button size="sm" variant="secondary" disabled={!view.zoho.configured || pending} onClick={() => run(() => testEmailAction({ provider: "zoho" }))}>
            Send test email
          </Button>
          {view.zoho.configured && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => clearProviderAction({ provider: "zoho" }))}>
              Remove password
            </Button>
          )}
        </div>
      </section>

      <div>
        <Button onClick={save} loading={pending}>
          Save email settings
        </Button>
        <p className={styles.help} style={{ marginTop: "var(--space-2)" }}>
          Save first, then use &quot;Send test email&quot; to check each provider. Secrets are encrypted and never shown again.
        </p>
      </div>
    </div>
  );
}
