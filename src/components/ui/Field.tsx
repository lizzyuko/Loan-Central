import { useId, type ComponentProps, type ReactNode } from "react";
import { cx } from "./cx";
import styles from "./Field.module.css";

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  /** Receives the ids to wire onto the control. */
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/** Label + control + hint + error, with correct ARIA wiring. */
export function Field({ label, hint, error, optional, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {optional && <span className={styles.optional}>Optional</span>}
      </label>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className={styles.error} role="alert">
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.5v4M8 11h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {children}
    </p>
  );
}

type InputProps = Omit<ComponentProps<"input">, "prefix"> & { invalid?: boolean; prefix?: ReactNode };

export function Input({ invalid, className, prefix, ...rest }: InputProps) {
  if (prefix) {
    return (
      <div className={cx(styles.affix, invalid && styles.invalid)}>
        <span className={styles.prefix}>{prefix}</span>
        <input className={cx(styles.control, styles.bare, className)} aria-invalid={invalid || undefined} {...rest} />
      </div>
    );
  }
  return (
    <input
      className={cx(styles.control, invalid && styles.invalid, className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

type SelectProps = ComponentProps<"select"> & {
  invalid?: boolean;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
};

export function Select({ invalid, className, options, placeholder, ...rest }: SelectProps) {
  return (
    <div className={styles.selectWrap}>
      <select
        className={cx(styles.control, styles.select, invalid && styles.invalid, className)}
        aria-invalid={invalid || undefined}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg className={styles.chevron} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

type TextareaProps = ComponentProps<"textarea"> & { invalid?: boolean };

export function Textarea({ invalid, className, rows = 4, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cx(styles.control, styles.textarea, invalid && styles.invalid, className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

type CheckboxProps = Omit<ComponentProps<"input">, "type"> & { label: ReactNode; error?: string };

export function Checkbox({ label, error, className, id, ...rest }: CheckboxProps) {
  const autoId = useId();
  const cbId = id ?? autoId;
  const errorId = error ? `${cbId}-error` : undefined;
  return (
    <div className={cx(styles.checkboxField, className)}>
      <div className={styles.checkboxRow}>
        <input
          id={cbId}
          type="checkbox"
          className={styles.checkbox}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={errorId}
          {...rest}
        />
        <label htmlFor={cbId} className={styles.checkboxLabel}>
          {label}
        </label>
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
