"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChoiceCards } from "@/components/ui/ChoiceCards";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { currencyOptions, formatMoney } from "@/config/currencies";
import { DEFAULT_TERM_OPTIONS_MONTHS, LOAN_PURPOSES, REPAYMENT_FREQUENCY_LABELS } from "@/config/site";
import { REPAYMENT_FREQUENCIES } from "@/db/schema/enums";
import { loanDetailsSchema, type LoanDetailsInput } from "@/lib/validation/application";
import { StepShell } from "../StepShell";
import type { WizardProduct } from "../types";
import styles from "../Wizard.module.css";

interface Props {
  defaultValues?: Partial<LoanDetailsInput>;
  products: WizardProduct[];
  defaultCurrency: string;
  onNext: (values: LoanDetailsInput) => void;
}

const NOT_SURE = "";

export function LoanStep({ defaultValues, products, defaultCurrency, onNext }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loanDetailsSchema),
    mode: "onTouched",
    defaultValues: {
      productSlug: NOT_SURE,
      purpose: undefined,
      purposeDetails: "",
      amount: "",
      currency: defaultCurrency,
      termMonths: "",
      repaymentFrequency: "MONTHLY",
      ...defaultValues,
    },
  });

  const productSlug = watch("productSlug");
  const repaymentFrequency = watch("repaymentFrequency");
  const product = products.find((p) => p.slug === productSlug);

  // Selecting a product pre-fills its purpose (user can still change it).
  useEffect(() => {
    if (product && !getValues("purpose")) {
      setValue("purpose", product.purposeKey as LoanDetailsInput["purpose"], { shouldValidate: false });
    }
  }, [product, getValues, setValue]);

  const termOptions = useMemo(() => {
    const terms = product?.termOptionsMonths.length ? product.termOptionsMonths : [...DEFAULT_TERM_OPTIONS_MONTHS];
    return terms.map((m) => ({ value: String(m), label: m % 12 === 0 ? `${m / 12} year${m === 12 ? "" : "s"} (${m} months)` : `${m} months` }));
  }, [product]);

  const currencies = useMemo(() => {
    const all = currencyOptions();
    if (!product?.supportedCurrencies.length) return all;
    return all.filter((c) => product.supportedCurrencies.includes(c.value));
  }, [product]);

  const productOptions = [
    ...products.map((p) => ({ value: p.slug, label: p.name, description: p.shortDescription })),
    { value: NOT_SURE, label: "Not sure yet", description: "Tell us what you need and we'll consider the options." },
  ];

  return (
    <StepShell
      title="What are you looking for?"
      description="Start with the basics. You can change any answer before you submit."
      onSubmit={handleSubmit((values) => onNext(values as LoanDetailsInput))}
    >
      {products.length > 0 && (
        <ChoiceCards
          legend="Type of loan"
          options={productOptions}
          columns={products.length + 1 > 4 ? 3 : 2}
          selected={productSlug ?? NOT_SURE}
          {...register("productSlug")}
        />
      )}

      <Field label="What is the loan for?" error={errors.purpose?.message}>
        {({ id, describedBy, invalid }) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            placeholder="Select a purpose"
            options={LOAN_PURPOSES}
            {...register("purpose")}
          />
        )}
      </Field>

      <Field label="Tell us a little more" optional error={errors.purposeDetails?.message} hint="A sentence or two is plenty.">
        {({ id, describedBy, invalid }) => (
          <Textarea id={id} aria-describedby={describedBy} invalid={invalid} rows={3} maxLength={500} {...register("purposeDetails")} />
        )}
      </Field>

      <div className={`${styles.row} ${styles.rowAmount}`}>
        <Field
          label="How much would you like to borrow?"
          error={errors.amount?.message}
          hint={
            product
              ? `Indicative range: ${formatMoney(product.minAmount, product.baseCurrency)} to ${formatMoney(product.maxAmount, product.baseCurrency)}`
              : undefined
          }
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 15000"
              {...register("amount")}
            />
          )}
        </Field>
        <Field label="Currency" error={errors.currency?.message}>
          {({ id, describedBy, invalid }) => (
            <Select id={id} aria-describedby={describedBy} invalid={invalid} placeholder="Select" options={currencies} {...register("currency")} />
          )}
        </Field>
      </div>

      <Field label="Preferred repayment period" error={errors.termMonths?.message}>
        {({ id, describedBy, invalid }) => (
          <Select id={id} aria-describedby={describedBy} invalid={invalid} placeholder="Select a period" options={termOptions} {...register("termMonths")} />
        )}
      </Field>

      <ChoiceCards
        legend="How often would you prefer to repay?"
        options={REPAYMENT_FREQUENCIES.map((f) => ({ value: f, label: REPAYMENT_FREQUENCY_LABELS[f] }))}
        columns={3}
        selected={repaymentFrequency}
        error={errors.repaymentFrequency?.message}
        {...register("repaymentFrequency")}
      />
    </StepShell>
  );
}
