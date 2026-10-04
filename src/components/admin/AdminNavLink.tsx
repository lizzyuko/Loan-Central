"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./AdminShell.module.css";

export function AdminNavLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} className={styles.navLink} aria-current={active ? "page" : undefined}>
      <span aria-hidden="true">{icon}</span>
      {children}
    </Link>
  );
}
