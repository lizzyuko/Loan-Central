import type { Metadata } from "next";
import { AddAdminForm, AdminRowForm } from "@/components/admin/SettingsForms";
import { Badge } from "@/components/ui/Feedback";
import { listAdmins } from "@/lib/admin/settings";
import { requireAdminPage } from "@/lib/auth/admin";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import styles from "@/components/admin/admin.module.css";
import s from "@/components/admin/settings.module.css";

export const metadata: Metadata = { title: "Administrators" };

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminsPage() {
  const me = await requireAdminPage("admins.manage");
  const rows = await listAdmins();

  return (
    <div className={s.stack}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Administrators</h1>
          <p className={styles.pageSubtitle}>Only listed, active administrators can request a sign-in code.</p>
        </div>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Add an administrator</h2>
        </div>
        <AddAdminForm />
      </section>

      <section className={styles.panel}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Last sign-in</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.name} {!a.isActive && <Badge tone="danger">Inactive</Badge>}
                  </td>
                  <td>{a.email}</td>
                  <td>{ROLE_LABELS[a.role]}</td>
                  <td className={styles.muted}>{a.lastLoginAt ? dateTime.format(a.lastLoginAt) : "Never"}</td>
                  <td>
                    <AdminRowForm adminId={a.id} role={a.role} isActive={a.isActive} isSelf={a.id === me.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
