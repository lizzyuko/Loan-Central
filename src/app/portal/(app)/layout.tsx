import Link from "next/link";
import { SignOut } from "@phosphor-icons/react/ssr";
import { Logo } from "@/components/ui/Logo";
import { requireApplicantPage } from "@/lib/auth/applicant";
import { logoutApplicant } from "../(auth)/actions";
import styles from "./portal.module.css";

export default async function PortalAppLayout({ children }: { children: React.ReactNode }) {
  const applicant = await requireApplicantPage();
  return (
    <>
      <header className={styles.header}>
        <div className={`container ${styles.headerInner}`}>
          <Logo href="/portal" />
          <div className={styles.account}>
            <Link href="/portal/account" className={styles.email} title="Your account">
              {applicant.email}
            </Link>
            <form action={logoutApplicant}>
              <button type="submit" className={styles.signOut}>
                <SignOut size={16} aria-hidden="true" /> Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className={`container-narrow ${styles.main}`}>
        {children}
      </main>
    </>
  );
}
