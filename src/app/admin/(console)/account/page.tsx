import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/forms/PasswordAuthForms";
import { requireAdminPage } from "@/lib/auth/admin";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { changeOwnPassword } from "../../(auth)/actions";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage() {
  const admin = await requireAdminPage();
  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Your account</h1>
          <p className={styles.pageSubtitle}>
            {admin.name} · {admin.email} · {ROLE_LABELS[admin.role]}
          </p>
        </div>
      </div>
      <section className={styles.panel} style={{ maxWidth: 520 }}>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Change password</h2>
        </div>
        <div className={styles.panelBody}>
          <ChangePasswordForm email={admin.email} submit={changeOwnPassword} />
        </div>
      </section>
    </>
  );
}
