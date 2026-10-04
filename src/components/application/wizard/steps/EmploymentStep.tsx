"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, Input, Select } from "@/components/ui/Field";
import { ChoiceCards } from "@/components/ui/ChoiceCards";
import { currencyOptions } from "@/config/currencies";
import { EMPLOYER_REQUIRED_STATUSES, EMPLOYMENT_STATUS_LABELS, INCOME_FREQUENCY_LABELS } from "@/config/site";
import { EMPLOYMENT_STATUSES, INCOME_FREQUENCIES, type EmploymentStatus } from "@/db/schema/enums";
import { employmentSchema, type EmploymentInput } from "@/lib/validation/application";
import { StepShell } from "../StepShell";
import styles from "../Wizard.module.css";

interface Props {
  defaultValues?: Partial<EmploymentInput>;
  defaultCurrency: string;
  onNext: (values: EmploymentInput) => void;
  onBack: () => void;
}

const BUSINESS_STATUSES: EmploymentStatus[] = ["SELF_EMPLOYED", "BUSINESS_OWNER", "CONTRACTOR"];

export function EmploymentStep({ defaultValues, defaultCurrency, onNext, onBack }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(employmentSchema),
    mode: "onTouched",
    defaultValues: {
      employmentStatus: undefined,
      employerName: "",
      jobTitle: "",
      incomeAmount: "",
      incomeCurrency: defaultCurrency,
      incomeFrequency: "MONTHLY",
      monthsInRole: "",
      ...defaultValues,
    },
  });

  const status = watch("employmentStatus") as EmploymentStatus | undefined;
  const frequency = watch("incomeFrequency");
  const needsEmployer = status ? EMPLOYER_REQUIRED_STATUSES.includes(status) : false;
  const isBusiness = status ? BUSINESS_STATUSES.includes(status) : false;
  const currencies = useMemo(() => currencyOptions(), []);

  return (
    <StepShell
      title="Employment & income"
      description="Include your main source of income. Your reviewer may ask for evidence later."
      onSubmit={handleSubmit((values) => onNext(values as EmploymentInput))}
      onBack={onBack}
    >
      <Field label="Employment status" error={errors.employmentStatus?.message}>
        {({ id, describedBy, invalid }) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            placeholder="Select your status"
            options={EMPLOYMENT_STATUSES.map((s) => ({ value: s, label: EMPLOYMENT_STATUS_LABELS[s] }))}
            {...register("employmentStatus")}
          />
        )}
      </Field>

      {needsEmployer && (
        <div className={styles.row}>
          <Field label={isBusiness ? "Business name" : "Employer name"} error={errors.employerName?.message}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="organization" {...register("employerName")} />
            )}
          </Field>
          <Field label={isBusiness ? "Type of business" : "Job title"} optional error={errors.jobTitle?.message}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="organization-title" {...register("jobTitle")} />
            )}
          </Field>
        </div>
      )}

      {needsEmployer && (
        <Field
          label={isBusiness ? "How long has the business been operating?" : "How long have you been in this role?"}
          optional
          hint="In months"
          error={errors.monthsInRole?.message}
        >
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid} inputMode="numeric" placeholder="e.g. 24" {...register("monthsInRole")} />
          )}
        </Field>
      )}

      <hr className={styles.divider} />

      <div className={`${styles.row} ${styles.rowAmount}`}>
        <Field label="Income before tax" error={errors.incomeAmount?.message} hint="Enter 0 if you currently have no income.">
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid} inputMode="decimal" placeholder="e.g. 4200" {...register("incomeAmount")} />
          )}
        </Field>
        <Field label="Income currency" error={errors.incomeCurrency?.message}>
          {({ id, describedBy, invalid }) => (
            <Select id={id} aria-describedby={describedBy} invalid={invalid} placeholder="Select" options={currencies} {...register("incomeCurrency")} />
          )}
        </Field>
      </div>

      <ChoiceCards
        legend="How often do you receive this income?"
        options={INCOME_FREQUENCIES.map((f) => ({ value: f, label: INCOME_FREQUENCY_LABELS[f] }))}
        columns={4}
        selected={frequency}
        error={errors.incomeFrequency?.message}
        {...register("incomeFrequency")}
      />
    </StepShell>
  );
}
