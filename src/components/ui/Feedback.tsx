import type { ReactNode } from "react";
import type { StatusTone } from "@/lib/application/status";
import { cx } from "./cx";
import styles from "./Feedback.module.css";

export function Card({
  children,
  className,
  padded = true,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  as?: "div" | "section" | "article";
}) {
  return <Tag className={cx(styles.card, padded && styles.padded, className)}>{children}</Tag>;
}

export function Badge({ tone = "neutral", children }: { tone?: StatusTone; children: ReactNode }) {
  return (
    <span className={cx(styles.badge, styles[`badge_${tone}`])}>
      <span className={styles.dot} aria-hidden="true" />
      {children}
    </span>
  );
}

type AlertTone = "info" | "success" | "warning" | "danger";

const ALERT_ICONS: Record<AlertTone, ReactNode> = {
  info: <path d="M10 9v5M10 6.5h.01" />,
  success: <path d="M6.5 10.5l2.5 2.5 4.5-5" />,
  warning: <path d="M10 6.5v4.5M10 13.5h.01" />,
  danger: <path d="M7.5 7.5l5 5M12.5 7.5l-5 5" />,
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx(styles.alert, styles[`alert_${tone}`], className)} role={tone === "danger" ? "alert" : "status"}>
      <svg className={styles.alertIcon} width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {ALERT_ICONS[tone]}
        </g>
      </svg>
      <div className={styles.alertBody}>
        {title && <p className={styles.alertTitle}>{title}</p>}
        {children && <div className={styles.alertText}>{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" className={styles.emptyIcon}>
        <rect x="7" y="9" width="26" height="24" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 16h26M14 23h12M14 27h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <p className={styles.emptyTitle}>{title}</p>
      {children && <div className={styles.emptyText}>{children}</div>}
      {action}
    </div>
  );
}

export function Skeleton({ width = "100%", height = 16, radius }: { width?: string | number; height?: string | number; radius?: number }) {
  return <span className={styles.skeleton} style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}
