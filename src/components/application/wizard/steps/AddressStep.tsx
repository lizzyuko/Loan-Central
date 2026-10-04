"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, Input, Select } from "@/components/ui/Field";
import { countryOptions, getCountry } from "@/config/countries";
import { addressSchema, type AddressInput } from "@/lib/validation/application";
import { StepShell } from "../StepShell";
import styles from "../Wizard.module.css";

interface Props {
  defaultValues?: Partial<AddressInput>;
  defaultCountry: string;
  onNext: (values: AddressInput) => void;
  onBack: () => void;
}

/** Address fields adapt their labels and requirements to the chosen country. */
export function AddressStep({ defaultValues, defaultCountry, onNext, onBack }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(addressSchema),
    mode: "onTouched",
    defaultValues: {
      country: defaultCountry,
      region: "",
      city: "",
      line1: "",
      line2: "",
      postalCode: "",
      ...defaultValues,
    },
  });

  const countries = useMemo(() => countryOptions(), []);
  const country = getCountry(watch("country") || "");
  const fmt = country?.address;

  return (
    <StepShell
      title="Where do you live?"
      description="Enter your current residential address."
      onSubmit={handleSubmit((values) => onNext(values as AddressInput))}
      onBack={onBack}
    >
      <Field label="Country" error={errors.country?.message}>
        {({ id, describedBy, invalid }) => (
          <Select id={id} aria-describedby={describedBy} invalid={invalid} placeholder="Select a country" options={countries} autoComplete="country" {...register("country")} />
        )}
      </Field>

      <Field label="Address line 1" error={errors.line1?.message} hint="Street address or building">
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="address-line1" {...register("line1")} />
        )}
      </Field>

      <Field label="Address line 2" optional error={errors.line2?.message} hint="Apartment, suite, unit, district">
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="address-line2" {...register("line2")} />
        )}
      </Field>

      <div className={styles.row}>
        <Field label="City / town" error={errors.city?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="address-level2" {...register("city")} />
          )}
        </Field>
        <Field label={fmt?.regionLabel ?? "State / province / region"} optional={!fmt?.regionRequired} error={errors.region?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="address-level1" {...register("region")} />
          )}
        </Field>
      </div>

      <Field label={fmt?.postalLabel ?? "Postal code"} optional={!fmt?.postalRequired} error={errors.postalCode?.message}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="postal-code" className={styles.short} {...register("postalCode")} />
        )}
      </Field>
    </StepShell>
  );
}
