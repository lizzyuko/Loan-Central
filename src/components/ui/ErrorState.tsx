import type { ReactNode } from "react";
import { Logo } from "./Logo";
import styles from "./ErrorState.module.css";

export function ErrorState({ code, title, children, actions }: { code?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <main id="main" className={styles.page}>
      <div className={styles.inner}>
        <Logo />
        {code && <p className={styles.code}>{code}</p>}
        <h1 className={styles.title}>{title}</h1>
        {children && <div className={styles.text}>{children}</div>}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </main>
  );
}
