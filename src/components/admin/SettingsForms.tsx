"use client";

import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { ADMIN_ROLES, type AdminRole } from "@/db/schema/enums";
import { LOAN_PURPOSES } from "@/config/site";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import {
  createAdminAction,
  resendInviteAction,
  saveDocumentTypeAction,
  saveProductAction,
  updateAdminAction,
} from "@/app/admin/(console)/settings/actions";
import { ActionForm } from "./ActionForm";
import styles from "./settings.module.css";

const roleOptions = ADMIN_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

// --- Administrators -------------------------------------------------------------

export function AddAdminForm() {
  return (
    <ActionForm
      action={createAdminAction}
      resetOnSuccess
      className={styles.form}
      toInput={(fd) => ({ email: fd.get("email"), name: fd.get("name"), role: fd.get("role") })}
    >
      {(pending) => (
        <>
          <div className={`${styles.grid2} ${styles.grid3}`}>
            <Field label="Email">{({ id }) => <Input id={id} name="email" type="email" required autoComplete="off" />}</Field>
            <Field label="Name">{({ id }) => <Input id={id} name="name" required maxLength={80} />}</Field>
            <Field label="Role">{({ id }) => <Select id={id} name="role" defaultValue="ADMIN" options={roleOptions} />}</Field>
          </div>
          <div>
            <Button type="submit" size="sm" loading={pending}>
              Send invitation
            </Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function AdminRowForm({ adminId, role, isActive, isSelf }: { adminId: string; role: AdminRole; isActive: boolean; isSelf: boolean }) {
  if (isSelf) return <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>This is you</span>;
  return (
    <ActionForm
      action={updateAdminAction}
      className={styles.inlineRow}
      toInput={(fd) => ({ adminId, role: fd.get("role"), isActive: fd.get("isActive") === "on" })}
    >
      {(pending) => (
        <>
          <select name="role" defaultValue={role} aria-label="Role">
            {roleOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <label>
            <input type="checkbox" name="isActive" defaultChecked={isActive} /> Active
          </label>
          <Button type="submit" size="sm" variant="secondary" loading={pending}>
            Save
          </Button>
        </>
      )}
    </ActionForm>
  );
}

export function ResendInviteButton({ adminId }: { adminId: string }) {
  return (
    <ActionForm action={resendInviteAction} className={styles.inlineRow} toInput={() => ({ adminId })}>
      {(pending) => (
        <Button type="submit" size="sm" variant="ghost" loading={pending}>
          Resend invite
        </Button>
      )}
    </ActionForm>
  );
}

// --- Document types ---------------------------------------------------------------

interface DocTypeValues {
  key: string;
  label: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
}

export function DocumentTypeForm({ value }: { value?: DocTypeValues }) {
  return (
    <ActionForm
      action={saveDocumentTypeAction}
      resetOnSuccess={!value}
      className={styles.docRow}
      toInput={(fd) => ({
        key: value?.key ?? fd.get("key"),
        label: fd.get("label"),
        description: fd.get("description"),
        isActive: fd.get("isActive") === "on",
        sortOrder: fd.get("sortOrder"),
      })}
    >
      {(pending) => (
        <>
          {value ? (
            <span className={styles.key}>{value.key}</span>
          ) : (
            <Field label="Key">{({ id }) => <Input id={id} name="key" required placeholder="e.g. bank_statement" />}</Field>
          )}
          <Field label="Label">{({ id }) => <Input id={id} name="label" defaultValue={value?.label} required maxLength={80} />}</Field>
          <Field label="Description">{({ id }) => <Input id={id} name="description" defaultValue={value?.description} required maxLength={300} />}</Field>
          <Field label="Order">{({ id }) => <Input id={id} name="sortOrder" type="number" min={0} max={999} defaultValue={value?.sortOrder ?? 10} />}</Field>
          <Checkbox name="isActive" defaultChecked={value?.isActive ?? true} label="Active" />
          <Button type="submit" size="sm" variant={value ? "secondary" : "primary"} loading={pending}>
            {value ? "Save" : "Add"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

// --- Loan products -------------------------------------------------------------------

export interface ProductValues {
  id?: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  purposeKey: string;
  minAmount: string;
  maxAmount: string;
  baseCurrency: string;
  supportedCurrencies: string[];
  supportedCountries: string[];
  termOptionsMonths: number[];
  requiredDocumentTypes: string[];
  isActive: boolean;
  sortOrder: number;
}

export function ProductForm({ value, documentTypes }: { value?: ProductValues; documentTypes: { key: string; label: string }[] }) {
  return (
    <ActionForm
      action={saveProductAction}
      redirectTo="/admin/settings/products"
      className={styles.form}
      toInput={(fd) => ({
        id: value?.id,
        slug: fd.get("slug"),
        name: fd.get("name"),
        shortDescription: fd.get("shortDescription"),
        description: fd.get("description"),
        purposeKey: fd.get("purposeKey"),
        minAmount: fd.get("minAmount"),
        maxAmount: fd.get("maxAmount"),
        baseCurrency: fd.get("baseCurrency"),
        supportedCurrencies: fd.get("supportedCurrencies") ?? "",
        supportedCountries: fd.get("supportedCountries") ?? "",
        termOptionsMonths: fd.get("termOptionsMonths") ?? "",
        requiredDocumentTypes: fd.getAll("requiredDocumentTypes").map(String),
        isActive: fd.get("isActive") === "on",
        sortOrder: fd.get("sortOrder"),
      })}
    >
      {(pending) => (
        <>
          <div className={styles.grid2}>
            <Field label="Name">{({ id }) => <Input id={id} name="name" defaultValue={value?.name} required />}</Field>
            <Field label="Slug" hint="Used in links, e.g. /apply?product=personal-loan">
              {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} name="slug" defaultValue={value?.slug} required />}
            </Field>
          </div>
          <Field label="Short description">{({ id }) => <Input id={id} name="shortDescription" defaultValue={value?.shortDescription} required maxLength={160} />}</Field>
          <Field label="Description">{({ id }) => <Textarea id={id} name="description" defaultValue={value?.description} required maxLength={1000} rows={3} />}</Field>
          <div className={`${styles.grid2} ${styles.grid3}`}>
            <Field label="Purpose">
              {({ id }) => <Select id={id} name="purposeKey" defaultValue={value?.purposeKey ?? "personal"} options={LOAN_PURPOSES} />}
            </Field>
            <Field label="Minimum amount">{({ id }) => <Input id={id} name="minAmount" defaultValue={value?.minAmount} required inputMode="decimal" />}</Field>
            <Field label="Maximum amount">{({ id }) => <Input id={id} name="maxAmount" defaultValue={value?.maxAmount} required inputMode="decimal" />}</Field>
          </div>
          <div className={`${styles.grid2} ${styles.grid3}`}>
            <Field label="Range currency" hint="Indicative ranges are shown in this currency">
              {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} name="baseCurrency" defaultValue={value?.baseCurrency ?? "USD"} required maxLength={3} />}
            </Field>
            <Field label="Accepted currencies" optional hint="Comma-separated ISO codes. Empty = all.">
              {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} name="supportedCurrencies" defaultValue={value?.supportedCurrencies.join(", ")} />}
            </Field>
            <Field label="Available countries" optional hint="Comma-separated ISO codes. Empty = all.">
              {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} name="supportedCountries" defaultValue={value?.supportedCountries.join(", ")} />}
            </Field>
          </div>
          <div className={styles.grid2}>
            <Field label="Terms (months)" hint="Comma-separated, e.g. 12, 24, 36">
              {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} name="termOptionsMonths" defaultValue={value?.termOptionsMonths.join(", ")} required />}
            </Field>
            <Field label="Display order">{({ id }) => <Input id={id} name="sortOrder" type="number" min={0} max={999} defaultValue={value?.sortOrder ?? 10} />}</Field>
          </div>
          <fieldset style={{ border: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <legend style={{ fontSize: "var(--text-sm)", fontWeight: 500, marginBottom: "var(--space-2)" }}>Required documents</legend>
            <div className={styles.checks}>
              {documentTypes.map((t) => (
                <Checkbox key={t.key} name="requiredDocumentTypes" value={t.key} defaultChecked={value?.requiredDocumentTypes.includes(t.key)} label={t.label} />
              ))}
            </div>
          </fieldset>
          <Checkbox name="isActive" defaultChecked={value?.isActive ?? true} label="Active (shown on the website and in the application)" />
          <div>
            <Button type="submit" loading={pending}>
              Save product
            </Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
