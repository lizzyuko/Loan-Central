import type { Metadata } from "next";
import { LoanSettingsForm } from "@/components/admin/LoanForms";
import { requireAdminPage } from "@/lib/auth/admin";
import { getLoanSettings } from "@/lib/loans/settings";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Loan settings" };

export default async function LoanSettingsPage() {
  await requireAdminPage("settings.manage");
  const settings = await getLoanSettings();
  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Loans</h1>
          <p className={styles.pageSubtitle}>Repayment instructions appear in the applicant portal, approval emails and payment reminders.</p>
        </div>
      </div>
      <section className={styles.panel} style={{ maxWidth: 760 }}>
        <div className={styles.panelBody}>
          <LoanSettingsForm initial={settings.repaymentInstructions} />
        </div>
      </section>
    </>
  );
}
