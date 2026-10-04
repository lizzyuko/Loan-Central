"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChoiceCards } from "@/components/ui/ChoiceCards";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { currencyOptions } from "@/config/currencies";
import { financialSchema, type FinancialInput } from "@/lib/validation/application";
import { StepShell } from "../StepShell";
import styles from "../Wizard.module.css";

interface Props {
  defaultValues?: Partial<FinancialInput>;
  defaultCurrency: string;
  onNext: (values: FinancialInput) => void;
  onBack: () => void;
}

export function FinancialStep({ defaultValues, defaultCurrency, onNext, onBack }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(financialSchema),
    mode: "onTouched",
    defaultValues: {
      hasExistingLoans: undefined,
      existingLoanCount: "",
      monthlyDebtPayments: "",
      monthlyExpenses: "",
      currency: defaultCurrency,
      dependents: "",
      otherCommitments: "",
      ...defaultValues,
    },
  });

  const hasLoans = watch("hasExistingLoans");
  const currencies = useMemo(() => currencyOptions(), []);

  return (
    <StepShell
      title="Your finances"
      description="Approximate monthly figures are fine. We only ask what's needed to understand affordability."
      onSubmit={handleSubmit((values) => onNext(values as FinancialInput))}
      onBack={onBack}
    >
      <ChoiceCards
        legend="Do you currently have any loans or credit agreements?"
        options={[
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ]}
        columns={2}
        selected={hasLoans}
        error={errors.hasExistingLoans?.message}
        {...register("hasExistingLoans")}
      />

      {hasLoans === "yes" && (
        <Field label="How many?" error={errors.existingLoanCount?.message} hint="Include credit cards with an outstanding balance.">
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid} inputMode="numeric" {...register("existingLoanCount")} />
          )}
        </Field>
      )}

      <Field label="Currency for these figures" error={errors.currency?.message}>
        {({ id, describedBy, invalid }) => (
          <Select id={id} aria-describedby={describedBy} invalid={invalid} placeholder="Select" options={currencies} {...register("currency")} />
        )}
      </Field>

      <div className={styles.row}>
        <Field label="Monthly debt repayments" error={errors.monthlyDebtPayments?.message} hint="Total across all loans and cards. Enter 0 if none.">
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid} inputMode="decimal" {...register("monthlyDebtPayments")} />
          )}
        </Field>
        <Field label="Other monthly expenses" error={errors.monthlyExpenses?.message} hint="Rent, bills, food, transport and similar.">
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid} inputMode="decimal" {...register("monthlyExpenses")} />
          )}
        </Field>
      </div>

      <Field label="Number of financial dependants" optional error={errors.dependents?.message}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} inputMode="numeric" {...register("dependents")} />
        )}
      </Field>

      <Field label="Anything else we should know?" optional error={errors.otherCommitments?.message} hint="For example, upcoming changes to your income or commitments.">
        {({ id, describedBy, invalid }) => (
          <Textarea id={id} aria-describedby={describedBy} invalid={invalid} rows={3} maxLength={1000} {...register("otherCommitments")} />
        )}
      </Field>
    </StepShell>
  );
}
