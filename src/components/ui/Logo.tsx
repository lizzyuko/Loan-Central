import Link from "next/link";
import { siteConfig } from "@/config/site";
import styles from "./Logo.module.css";

/** Mark: an open ring around a centred point — "central". */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={styles.mark}>
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path
        d="M21.6 10.4a8 8 0 1 0 0 11.2"
        fill="none"
        stroke="var(--logo-fg, #fff)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="2.6" fill="var(--logo-fg, #fff)" />
    </svg>
  );
}

export function Logo({ href = "/", inverse = false }: { href?: string; inverse?: boolean }) {
  return (
    <Link href={href} className={styles.logo} data-inverse={inverse || undefined} aria-label={`${siteConfig.name} home`}>
      <LogoMark />
      <span className={styles.word}>
        Loan<span className={styles.light}>Central</span>
      </span>
    </Link>
  );
}
