"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { LockSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { Checkbox, Field, Input, Select } from "@/components/ui/Field";
import { BANK_SCHEMES } from "@/config/banking";
import { countryOptions, getCountry } from "@/config/countries";
import { currencyOptions } from "@/config/currencies";
import { submitAccountDetailsAction } from "@/app/portal/(app)/actions";

interface Props {
  applicationId: string;
  defaultCountry: string;
  defaultCurrency: string;
}

/** Fields adapt to the banking identifiers used in the selected country. */
export function AccountDetailsForm({ applicationId, defaultCountry, defaultCurrency }: Props) {
  const [country, setCountry] = useState(defaultCountry);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [holder, setHolder] = useState("");
  const [bank, setBank] = useState("");
  const [identifiers, setIdentifiers] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const countries = useMemo(() => countryOptions(), []);
  const currencies = useMemo(() => currencyOptions(), []);
  const scheme = getCountry(country)?.bankScheme ?? "GENERIC";
  const fields = BANK_SCHEMES[scheme];

  function onCountryChange(next: string) {
    setCountry(next);
    setIdentifiers({});
    setErrors({});
    const cur = getCountry(next)?.defaultCurrency;
    if (cur) setCurrency(cur);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setErrors({});
    const allowed = new Set<string>(fields.map((f) => f.key));
    const cleaned = Object.fromEntries(Object.entries(identifiers).filter(([k, v]) => allowed.has(k) && v.trim()));
    start(async () => {
      const res = await submitAccountDetailsAction({
        applicationId,
        accountHolderName: holder,
        bankName: bank,
        country,
        currency,
        identifiers: cleaned,
        confirm,
      });
      if (!res.ok) {
        setError(res.error);
        setErrors(res.fieldErrors ?? {});
        return;
      }
      // Clear sensitive values from memory once saved.
      setIdentifiers({});
    });
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <Alert tone="info" title="Your application has progressed to the next stage">
        Please provide the requested account information below. It is encrypted and only visible to authorised staff.
      </Alert>
      {error && <Alert tone="danger">{error}</Alert>}

      <Field label="Account holder name" error={errors.accountHolderName} hint="As it appears on the account">
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} value={holder} onChange={(e) => setHolder(e.target.value)} autoComplete="name" maxLength={140} />
        )}
      </Field>

      <Field label="Bank or financial institution" error={errors.bankName}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} value={bank} onChange={(e) => setBank(e.target.value)} autoComplete="off" maxLength={140} />
        )}
      </Field>

      <div style={{ display: "grid", gap: "var(--space-5)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <Field label="Country of the account" error={errors.country}>
          {({ id, describedBy, invalid }) => (
            <Select id={id} aria-describedby={describedBy} invalid={invalid} value={country} onChange={(e) => onCountryChange(e.target.value)} options={countries} placeholder="Select a country" />
          )}
        </Field>
        <Field label="Account currency" error={errors.currency}>
          {({ id, describedBy, invalid }) => (
            <Select id={id} aria-describedby={describedBy} invalid={invalid} value={currency} onChange={(e) => setCurrency(e.target.value)} options={currencies} placeholder="Select" />
          )}
        </Field>
      </div>

      {country &&
        fields.map((f) => (
          <Field key={`${scheme}-${f.key}`} label={f.label} optional={!f.required} hint={f.hint} error={errors[`identifiers.${f.key}`]}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                value={identifiers[f.key] ?? ""}
                onChange={(e) => setIdentifiers((v) => ({ ...v, [f.key]: e.target.value }))}
                inputMode={f.inputMode}
                maxLength={f.maxLength + 8}
                autoComplete="off"
                spellCheck={false}
                style={{ fontFamily: "var(--font-mono)" }}
              />
            )}
          </Field>
        ))}

      <Checkbox
        checked={confirm}
        onChange={(e) => setConfirm(e.target.checked)}
        label="I confirm this account is in my name and the details are correct."
        error={errors.confirm}
      />

      <div>
        <Button type="submit" size="lg" loading={pending} iconLeft={<LockSimple size={16} />}>
          Submit securely
        </Button>
      </div>
    </form>
  );
}
