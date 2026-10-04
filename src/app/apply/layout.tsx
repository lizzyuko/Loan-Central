import Link from "next/link";
import { LockSimple } from "@phosphor-icons/react/ssr";
import { Logo } from "@/components/ui/Logo";
import { LOAN_DISCLAIMER } from "@/content/legal";
import styles from "./apply.module.css";

/** Focused layout for the application: no marketing navigation. */
export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className={styles.header}>
        <div className={`container ${styles.inner}`}>
          <Logo />
          <p className={styles.secure}>
            <LockSimple size={16} aria-hidden="true" /> Secure application
          </p>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className={styles.footer}>
        <div className="container">
          <p>{LOAN_DISCLAIMER}</p>
          <p className={styles.links}>
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/disclaimer">Loan disclosure</Link>
            <Link href="/contact">Help</Link>
          </p>
        </div>
      </footer>
    </>
  );
}
