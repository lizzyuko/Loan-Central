import { useId, type ComponentProps, type ReactNode } from "react";
import { cx } from "./cx";
import { FieldError } from "./Field";
import styles from "./ChoiceCards.module.css";

interface Option {
  value: string;
  label: string;
  description?: string;
}

type Props = Omit<ComponentProps<"input">, "type"> & {
  legend: ReactNode;
  options: readonly Option[];
  error?: string;
  columns?: 1 | 2 | 3 | 4;
  /** Currently selected value (to style the active card). */
  selected?: string;
};

/** Radio group rendered as large tappable cards. Works with RHF `register`. */
export function ChoiceCards({ legend, options, error, columns = 2, selected, className, ...input }: Props) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <fieldset className={cx(styles.fieldset, className)} aria-describedby={errorId}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.grid} data-columns={columns}>
        {options.map((o) => (
          <label key={o.value} className={cx(styles.card, selected === o.value && styles.active)}>
            <input type="radio" value={o.value} className={styles.radio} {...input} />
            <span className={styles.text}>
              <span className={styles.label}>{o.label}</span>
              {o.description && <span className={styles.description}>{o.description}</span>}
            </span>
          </label>
        ))}
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </fieldset>
  );
}
