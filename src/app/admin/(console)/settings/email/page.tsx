import type { Metadata } from "next";
import { EmailSettingsForm } from "@/components/admin/EmailSettingsForm";
import { envResendConfig } from "@/lib/env";
import { getEmailSettingsView, ZOHO_HOSTS } from "@/lib/email/settings";
import { requireAdminPage } from "@/lib/auth/admin";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Email settings" };

export default async function EmailSettingsPage() {
  await requireAdminPage("settings.manage");
  const view = await getEmailSettingsView();
  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Email</h1>
          <p className={styles.pageSubtitle}>Choose how Loan Central sends email: Resend or Zoho Mail.</p>
        </div>
      </div>
      <div style={{ maxWidth: 860 }}>
        <EmailSettingsForm view={view} zohoHosts={ZOHO_HOSTS} envFallback={Boolean(envResendConfig())} />
      </div>
    </>
  );
}
