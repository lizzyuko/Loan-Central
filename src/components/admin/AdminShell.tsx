import Link from "next/link";
import type { ReactNode } from "react";
import { ClockCounterClockwise, Files, FileText, Package, SignOut, SquaresFour, UsersThree } from "@phosphor-icons/react/ssr";
import { Logo } from "@/components/ui/Logo";
import { ROLE_LABELS, hasPermission } from "@/lib/auth/permissions";
import type { CurrentAdmin } from "@/lib/auth/admin";
import { logoutAdmin } from "@/app/admin/(auth)/actions";
import { AdminNavLink } from "./AdminNavLink";
import styles from "./AdminShell.module.css";

export function AdminShell({ admin, children }: { admin: CurrentAdmin; children: ReactNode }) {
  const nav = [
    { href: "/admin/dashboard", label: "Dashboard", icon: <SquaresFour size={18} />, show: true },
    { href: "/admin/applications", label: "Applications", icon: <Files size={18} />, show: true },
  ];
  const settings = [
    { href: "/admin/settings/products", label: "Loan products", icon: <Package size={18} />, show: hasPermission(admin.role, "products.manage") },
    { href: "/admin/settings/documents", label: "Document types", icon: <FileText size={18} />, show: hasPermission(admin.role, "documents.configure") },
    { href: "/admin/settings/admins", label: "Administrators", icon: <UsersThree size={18} />, show: hasPermission(admin.role, "admins.manage") },
    { href: "/admin/audit", label: "Audit log", icon: <ClockCounterClockwise size={18} />, show: hasPermission(admin.role, "audit.view") },
  ].filter((i) => i.show);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <Logo href="/admin/dashboard" />
        </div>
        <nav className={styles.nav} aria-label="Admin">
          <ul>
            {nav.map((i) => (
              <li key={i.href}>
                <AdminNavLink href={i.href} icon={i.icon}>
                  {i.label}
                </AdminNavLink>
              </li>
            ))}
          </ul>
          {settings.length > 0 && (
            <>
              <p className={styles.navGroup}>Settings</p>
              <ul>
                {settings.map((i) => (
                  <li key={i.href}>
                    <AdminNavLink href={i.href} icon={i.icon}>
                      {i.label}
                    </AdminNavLink>
                  </li>
                ))}
              </ul>
            </>
          )}
        </nav>
        <div className={styles.user}>
          <Link href="/admin/account" className={styles.userInfo} title="Your account">
            <p className={styles.userName}>{admin.name}</p>
            <p className={styles.userRole}>{ROLE_LABELS[admin.role]}</p>
          </Link>
          <form action={logoutAdmin}>
            <button type="submit" className={styles.logout} aria-label="Sign out">
              <SignOut size={18} />
            </button>
          </form>
        </div>
      </aside>
      <div className={styles.content}>
        <main id="main" className={styles.main}>
          {children}
        </main>
      </div>
    </div>
  );
}
