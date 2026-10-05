"use client";

import { useEffect, useState, useTransition } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { BANK_SCHEMES } from "@/config/banking";
import { revealAccountAction, revealNationalIdAction } from "@/app/admin/(console)/applications/[id]/actions";

const LABELS: Record<string, string> = Object.fromEntries(
  Object.values(BANK_SCHEMES)
    .flat()
    .map((f) => [f.key, f.label]),
);

/** Reveals decrypted identifiers on explicit request; auto-hides after 60s. */
export function AccountDetailsReveal({ applicationId }: { applicationId: string }) {
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!values) return;
    const t = window.setTimeout(() => setValues(null), 60_000);
    return () => window.clearTimeout(t);
  }, [values]);

  if (values) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <Alert tone="warning">This access has been recorded in the audit log. Details hide automatically after 60 seconds.</Alert>
        <dl style={{ display: "grid", gap: "var(--space-2)" }}>
          {Object.entries(values).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)", fontSize: "var(--text-sm)" }}>
              <dt style={{ color: "var(--color-text-muted)" }}>{LABELS[k] ?? k}</dt>
              <dd style={{ margin: 0, fontFamily: "var(--font-mono)" }}>{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <Button size="sm" variant="ghost" iconLeft={<EyeSlash size={16} />} onClick={() => setValues(null)}>
            Hide
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {error && <Alert tone="danger">{error}</Alert>}
      <div>
        <Button
          size="sm"
          variant="secondary"
          iconLeft={<Eye size={16} />}
          loading={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await revealAccountAction({ applicationId });
              if (res.ok) setValues(res.values);
              else setError(res.error);
            })
          }
        >
          Reveal full details
        </Button>
      </div>
    </div>
  );
}

/** Reveals the applicant's national ID number on request; hides again after 60s. */
export function NationalIdReveal({ applicationId }: { applicationId: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!value) return;
    const t = window.setTimeout(() => setValue(null), 60_000);
    return () => window.clearTimeout(t);
  }, [value]);

  if (value) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
        <span style={{ fontFamily: "var(--font-mono)" }}>{value}</span>
        <Button size="sm" variant="ghost" iconLeft={<EyeSlash size={14} />} onClick={() => setValue(null)}>
          Hide
        </Button>
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
      <Button
        size="sm"
        variant="ghost"
        iconLeft={<Eye size={14} />}
        loading={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await revealNationalIdAction({ applicationId });
            if (res.ok) setValue(res.value);
            else setError(res.error);
          })
        }
      >
        Reveal
      </Button>
      {error && <span style={{ color: "var(--color-danger)", fontSize: "var(--text-xs)" }}>{error}</span>}
    </span>
  );
}
