"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, Input, Select } from "@/components/ui/Field";
import { countryOptions, getCountry } from "@/config/countries";
import { nationalIdSpec } from "@/config/national-ids";
import { personalInfoSchema, type PersonalInfoInput } from "@/lib/validation/application";
import { StepShell } from "../StepShell";
import styles from "../Wizard.module.css";

interface Props {
  defaultValues?: Partial<PersonalInfoInput>;
  defaultCountry: string;
  onNext: (values: PersonalInfoInput) => void;
  onBack: () => void;
}

export function PersonalStep({ defaultValues, defaultCountry, onNext, onBack }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(personalInfoSchema),
    mode: "onTouched",
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      dateOfBirth: "",
      email: "",
      phoneCountry: defaultCountry,
      phoneNumber: "",
      countryOfResidence: defaultCountry,
      nationality: "",
      nationalId: "",
      ...defaultValues,
    },
  });

  const countries = useMemo(() => countryOptions(), []);
  const phoneCountries = useMemo(
    () =>
      countries
        .map((c) => ({ value: c.value, label: `${c.label} (${getCountry(c.value)?.dialCode ?? ""})` }))
        .filter((c) => !c.label.endsWith("()")),
    [countries],
  );
  const phoneCountry = watch("phoneCountry");
  const idSpec = nationalIdSpec(watch("countryOfResidence"));
  const dial = phoneCountry ? getCountry(phoneCountry)?.dialCode : null;

  return (
    <StepShell
      title="About you"
      description="Please use your legal name as it appears on your identity documents."
      onSubmit={handleSubmit((values) => onNext(values as PersonalInfoInput))}
      onBack={onBack}
    >
      <div className={`${styles.row} ${styles.rowThree}`}>
        <Field label="First name" error={errors.firstName?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="given-name" {...register("firstName")} />
          )}
        </Field>
        <Field label="Middle name" optional error={errors.middleName?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="additional-name" {...register("middleName")} />
          )}
        </Field>
        <Field label="Last name" error={errors.lastName?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="family-name" {...register("lastName")} />
          )}
        </Field>
      </div>

      <Field label="Date of birth" error={errors.dateOfBirth?.message} hint="You must be 18 or older to apply.">
        {({ id, describedBy, invalid }) => (
          <Input id={id} type="date" aria-describedby={describedBy} invalid={invalid} autoComplete="bday" max={new Date().toISOString().slice(0, 10)} {...register("dateOfBirth")} />
        )}
      </Field>

      <hr className={styles.divider} />

      <Field
        label="Email address"
        error={errors.email?.message}
        hint="We'll send updates here, and you'll use it to sign in to your applicant portal."
      >
        {({ id, describedBy, invalid }) => (
          <Input id={id} type="email" aria-describedby={describedBy} invalid={invalid} autoComplete="email" inputMode="email" {...register("email")} />
        )}
      </Field>

      <div className={`${styles.row} ${styles.rowPhone}`}>
        <Field label="Phone country" error={errors.phoneCountry?.message}>
          {({ id, describedBy, invalid }) => (
            <Select id={id} aria-describedby={describedBy} invalid={invalid} placeholder="Select" options={phoneCountries} autoComplete="tel-country-code" {...register("phoneCountry")} />
          )}
        </Field>
        <Field label="Phone number" error={errors.phoneNumber?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="tel"
              aria-describedby={describedBy}
              invalid={invalid}
              autoComplete="tel-national"
              inputMode="tel"
              prefix={dial ?? "+"}
              {...register("phoneNumber")}
            />
          )}
        </Field>
      </div>

      <hr className={styles.divider} />

      <div className={styles.row}>
        <Field label="Country of residence" error={errors.countryOfResidence?.message}>
          {({ id, describedBy, invalid }) => (
            <Select id={id} aria-describedby={describedBy} invalid={invalid} placeholder="Select a country" options={countries} autoComplete="country" {...register("countryOfResidence")} />
          )}
        </Field>
        <Field label="Nationality" optional error={errors.nationality?.message}>
          {({ id, describedBy, invalid }) => (
            <Select id={id} aria-describedby={describedBy} invalid={invalid} placeholder="Prefer not to say" options={countries} {...register("nationality")} />
          )}
        </Field>
      </div>

      <Field
        label={idSpec.label}
        optional={!idSpec.required}
        error={errors.nationalId?.message}
        hint={`${idSpec.hint}. Encrypted and only visible to authorised staff. It isn't saved in this browser, so you'll need to re-enter it if you reload.`}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            autoComplete="off"
            spellCheck={false}
            inputMode={idSpec.inputMode}
            maxLength={40}
            {...register("nationalId")}
          />
        )}
      </Field>
    </StepShell>
  );
}
