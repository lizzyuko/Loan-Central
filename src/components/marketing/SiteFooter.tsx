import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { siteConfig } from "@/config/site";
import { LOAN_DISCLAIMER } from "@/content/legal";
import styles from "./SiteFooter.module.css";

const COLUMNS = [
  {
    title: "Loan Central",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Applicants",
    links: [
      { href: "/apply", label: "Start an application" },
      { href: "/portal/login", label: "Track application" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/privacy", label: "Privacy Policy" },
      { href: "/legal/terms", label: "Terms of Use" },
      { href: "/legal/disclaimer", label: "Loan disclosure" },
      { href: "/legal/cookies", label: "Cookies & privacy" },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.top}>
          <div className={styles.brand}>
            <Logo />
            <p className={styles.tagline}>Loan pre-qualification, reviewed by people.</p>
          </div>
          <nav className={styles.columns} aria-label="Footer">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className={styles.colTitle}>{col.title}</p>
                <ul className={styles.list}>
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className={styles.link}>
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className={styles.bottom}>
          <p className={styles.disclaimer}>{LOAN_DISCLAIMER}</p>
          <p className={styles.copy}>
            © {year} {siteConfig.name}. We use essential cookies only.{" "}
            <Link href="/legal/cookies" className={styles.inlineLink}>
              Learn more
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
