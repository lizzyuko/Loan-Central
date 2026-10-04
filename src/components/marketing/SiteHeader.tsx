import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { LinkButton } from "@/components/ui/Button";
import { MobileNav } from "./MobileNav";
import styles from "./SiteHeader.module.css";

export const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#loan-options", label: "Loan options" },
  { href: "/#security", label: "Security" },
  { href: "/#faq", label: "FAQ" },
] as const;

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Logo />
        <nav className={styles.nav} aria-label="Main">
          <ul className={styles.links}>
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={styles.link}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.actions}>
          <Link href="/portal/login" className={styles.signIn}>
            Track application
          </Link>
          <LinkButton href="/apply" size="sm">
            Check your options
          </LinkButton>
        </div>
        <MobileNav links={NAV_LINKS} />
      </div>
    </header>
  );
}
