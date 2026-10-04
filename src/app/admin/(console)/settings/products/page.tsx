import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { Badge, EmptyState } from "@/components/ui/Feedback";
import { formatMoney } from "@/config/currencies";
import { listProducts } from "@/lib/admin/settings";
import { requireAdminPage } from "@/lib/auth/admin";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Loan products" };

export default async function ProductsPage() {
  await requireAdminPage("products.manage");
  const rows = await listProducts();

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Loan products</h1>
          <p className={styles.pageSubtitle}>Products shown on the website and offered in the application.</p>
        </div>
        <LinkButton href="/admin/settings/products/new" size="sm">
          New product
        </LinkButton>
      </div>
      <section className={styles.panel}>
        {rows.length === 0 ? (
          <EmptyState title="No products yet" />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Indicative range</th>
                  <th>Terms</th>
                  <th>Required documents</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/settings/products/${p.id}`} className={styles.rowLink}>
                        {p.name}
                      </Link>
                      <div className={styles.muted}>{p.slug}</div>
                    </td>
                    <td>
                      {formatMoney(p.minAmount, p.baseCurrency)} to {formatMoney(p.maxAmount, p.baseCurrency)}
                    </td>
                    <td>{p.termOptionsMonths.join(", ")} mo</td>
                    <td className={styles.muted}>{p.requiredDocumentTypes.length}</td>
                    <td>{p.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
