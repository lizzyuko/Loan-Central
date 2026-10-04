import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";
import { Spinner } from "./Spinner";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "inverse";
type Size = "sm" | "md" | "lg";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  iconRight?: ReactNode;
  iconLeft?: ReactNode;
}

type ButtonProps = CommonProps & ComponentProps<"button"> & { loading?: boolean };
type LinkButtonProps = CommonProps & ComponentProps<typeof Link>;

function classes({ variant = "primary", size = "md", fullWidth }: CommonProps, extra?: string) {
  return cx(styles.button, styles[variant], styles[size], fullWidth && styles.full, extra);
}

export function Button({
  variant,
  size,
  fullWidth,
  loading = false,
  iconLeft,
  iconRight,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classes({ variant, size, fullWidth }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : iconLeft}
      <span>{children}</span>
      {!loading && iconRight}
    </button>
  );
}

export function LinkButton({ variant, size, fullWidth, iconLeft, iconRight, className, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={classes({ variant, size, fullWidth }, className)} {...rest}>
      {iconLeft}
      <span>{children}</span>
      {iconRight}
    </Link>
  );
}
