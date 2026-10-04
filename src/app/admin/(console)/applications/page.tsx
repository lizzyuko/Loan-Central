import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { ApplicationTable } from "@/components/admin/ApplicationTable";
import { Button, LinkButton } from "@/components/ui/Button";
import { countryName } from "@/config/countries";
import { APPLICATION_STATUSES } from "@/db/schema/enums";
import { STATUS_LABELS } from "@/lib/application/status";
import { requireAdminPage } from "@/lib/auth/admin";
import { listApplicationCountries, listApplications, listParamsSchema, type ListParams } from "@/lib/admin/queries";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Applications" };

function buildHref(params: ListParams, patch: Partial<ListParams>): string {
  const merged = { ...params, ...patch };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return `/admin/applications${s ? `?${s}` : ""}`;
}

export default async function ApplicationsPage({ searchParams }: PageProps<"/admin/applications">) {
  await requireAdminPage();
  const raw = await searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || undefined]));
  const params = listParamsSchema.parse(flat);
  const [{ rows, total, page, pages }, countries] = await Promise.all([listApplications(params), listApplicationCountries()]);
  const hasFilters = Boolean(params.q || params.status || params.country || params.from || params.to);

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Applications</h1>
          <p className={styles.pageSubtitle}>
            {total.toLocaleString("en")} {hasFilters ? "matching" : "total"}
          </p>
        </div>
      </div>

      <section className={styles.panel}>
        <Form action="/admin/applications" className={styles.filters} role="search">
          <label className={styles.filterField}>
            Search
            <input type="search" name="q" defaultValue={params.q} placeholder="Reference, name or email" maxLength={100} />
          </label>
          <label className={styles.filterField}>
            Status
            <select name="status" defaultValue={params.status ?? ""}>
              <option value="">All statuses</option>
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filterField}>
            Country
            <select name="country" defaultValue={params.country ?? ""}>
              <option value="">All countries</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {countryName(c)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filterField}>
            Submitted from
            <input type="date" name="from" defaultValue={params.from} />
          </label>
          <label className={styles.filterField}>
            Submitted to
            <input type="date" name="to" defaultValue={params.to} />
          </label>
          <div className={styles.filterActions}>
            {params.sort && <input type="hidden" name="sort" value={params.sort} />}
            {params.dir && <input type="hidden" name="dir" value={params.dir} />}
            <Button type="submit" size="sm">
              Apply
            </Button>
            {hasFilters && (
              <LinkButton href="/admin/applications" size="sm" variant="ghost">
                Clear
              </LinkButton>
            )}
          </div>
        </Form>

        <ApplicationTable
          rows={rows}
          sortProps={{ sort: params.sort, dir: params.dir, hrefFor: (sort, dir) => buildHref(params, { sort: sort as ListParams["sort"], dir, page: undefined }) }}
        />

        {pages > 1 && (
          <nav className={styles.pagination} aria-label="Pagination">
            <span>
              Page {page} of {pages}
            </span>
            <span className={styles.pageLinks}>
              {page > 1 ? <Link href={buildHref(params, { page: page - 1 })}>Previous</Link> : <span aria-disabled="true">Previous</span>}
              {page < pages ? <Link href={buildHref(params, { page: page + 1 })}>Next</Link> : <span aria-disabled="true">Next</span>}
            </span>
          </nav>
        )}
      </section>
    </>
  );
}
