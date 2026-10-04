import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/SettingsForms";
import { getProduct, listDocumentTypes } from "@/lib/admin/settings";
import { requireAdminPage } from "@/lib/auth/admin";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Edit product" };

export default async function ProductEditPage({ params }: PageProps<"/admin/settings/products/[id]">) {
  await requireAdminPage("products.manage");
  const { id } = await params;
  const isNew = id === "new";
  const [product, docTypes] = await Promise.all([isNew ? null : getProduct(id), listDocumentTypes()]);
  if (!isNew && !product) notFound();

  return (
    <>
      <Link href="/admin/settings/products">All products</Link>
      <div className={styles.pageHeader} style={{ marginTop: "var(--space-4)" }}>
        <h1 className={styles.pageTitle}>{isNew ? "New product" : product!.name}</h1>
      </div>
      <section className={styles.panel}>
        <ProductForm value={product ?? undefined} documentTypes={docTypes.map((d) => ({ key: d.key, label: d.label }))} />
      </section>
    </>
  );
}
