import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";
import styles from "./AuthCard.module.css";

export function AuthCard({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main id="main" className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.logo}>
          <Logo />
        </div>
        <div className={styles.card}>
          <div className={styles.head}>
            <h1 className={styles.title}>{title}</h1>
            {description && <p className={styles.description}>{description}</p>}
          </div>
          {children}
        </div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </main>
  );
}
