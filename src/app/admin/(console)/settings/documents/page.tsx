import type { Metadata } from "next";
import { DocumentTypeForm } from "@/components/admin/SettingsForms";
import { listDocumentTypes } from "@/lib/admin/settings";
import { requireAdminPage } from "@/lib/auth/admin";
import styles from "@/components/admin/admin.module.css";
import s from "@/components/admin/settings.module.css";

export const metadata: Metadata = { title: "Document types" };

export default async function DocumentTypesPage() {
  await requireAdminPage("documents.configure");
  const rows = await listDocumentTypes();

  return (
    <div className={s.stack}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Document types</h1>
          <p className={styles.pageSubtitle}>Choose which documents each loan product requires on the product settings page.</p>
        </div>
      </div>
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Configured types</h2>
        </div>
        {rows.map((r) => (
          <DocumentTypeForm key={r.key} value={r} />
        ))}
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Add a document type</h2>
        </div>
        <DocumentTypeForm />
      </section>
    </div>
  );
}
