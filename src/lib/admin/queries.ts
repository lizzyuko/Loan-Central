import "server-only";
import { and, asc, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { applicants, applications, loanProducts, loanRequests } from "@/db/schema";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/db/schema/enums";

// --- Dashboard ----------------------------------------------------------------

export type StatusCounts = Record<ApplicationStatus, number> & { total: number };

export async function getStatusCounts(): Promise<StatusCounts> {
  const rows = await getDb().select({ status: applications.status, n: count() }).from(applications).groupBy(applications.status);
  const counts = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0])) as StatusCounts;
  counts.total = 0;
  for (const r of rows) {
    counts[r.status] = r.n;
    counts.total += r.n;
  }
  return counts;
}

export async function getSubmittedInLastDays(days: number): Promise<number> {
  const since = new Date(Date.now() - days * 86_400_000);
  const [row] = await getDb().select({ n: count() }).from(applications).where(gte(applications.submittedAt, since));
  return row?.n ?? 0;
}

// --- Application list ---------------------------------------------------------

export const SORT_KEYS = ["submitted", "updated", "amount", "reference", "applicant"] as const;

export const listParamsSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(APPLICATION_STATUSES).optional().catch(undefined),
  country: z.string().regex(/^[A-Z]{2}$/).optional().catch(undefined),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  sort: z.enum(SORT_KEYS).optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export type ListParams = z.infer<typeof listParamsSchema>;

export const PAGE_SIZE = 20;

export interface ApplicationListRow {
  id: string;
  reference: string;
  applicantName: string;
  applicantEmail: string;
  country: string;
  amount: string;
  currency: string;
  status: ApplicationStatus;
  productName: string | null;
  submittedAt: Date;
  updatedAt: Date;
}

/** Escape LIKE wildcards in user search terms. */
function likeTerm(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function listApplications(params: ListParams): Promise<{ rows: ApplicationListRow[]; total: number; page: number; pages: number }> {
  const filters: SQL[] = [];
  if (params.status) filters.push(eq(applications.status, params.status));
  if (params.country) filters.push(eq(applications.country, params.country));
  if (params.from) filters.push(gte(applications.submittedAt, new Date(`${params.from}T00:00:00Z`)));
  if (params.to) filters.push(lte(applications.submittedAt, new Date(`${params.to}T23:59:59.999Z`)));
  if (params.q) {
    const term = likeTerm(params.q);
    const nameMatch = ilike(sql`${applicants.firstName} || ' ' || ${applicants.lastName}`, term);
    filters.push(or(ilike(applications.reference, term), ilike(applicants.email, term), nameMatch)!);
  }
  const where = filters.length ? and(...filters) : undefined;

  const dir = params.dir === "asc" ? asc : desc;
  const orderBy = {
    submitted: dir(applications.submittedAt),
    updated: dir(applications.updatedAt),
    amount: dir(loanRequests.amount),
    reference: dir(applications.reference),
    applicant: dir(applicants.lastName),
  }[params.sort ?? "submitted"];

  const db = getDb();
  const [totalRow] = await db
    .select({ n: count() })
    .from(applications)
    .innerJoin(applicants, eq(applicants.id, applications.applicantId))
    .where(where);
  const total = totalRow?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(params.page ?? 1, pages);

  const rows = await db
    .select({
      id: applications.id,
      reference: applications.reference,
      firstName: applicants.firstName,
      lastName: applicants.lastName,
      applicantEmail: applicants.email,
      country: applications.country,
      amount: loanRequests.amount,
      currency: loanRequests.currency,
      status: applications.status,
      productName: loanProducts.name,
      submittedAt: applications.submittedAt,
      updatedAt: applications.updatedAt,
    })
    .from(applications)
    .innerJoin(applicants, eq(applicants.id, applications.applicantId))
    .innerJoin(loanRequests, eq(loanRequests.applicationId, applications.id))
    .leftJoin(loanProducts, eq(loanProducts.id, applications.loanProductId))
    .where(where)
    .orderBy(orderBy, desc(applications.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return {
    rows: rows.map(({ firstName, lastName, ...r }) => ({ ...r, applicantName: `${firstName} ${lastName}` })),
    total,
    page,
    pages,
  };
}

export async function listApplicationCountries(): Promise<string[]> {
  const rows = await getDb().selectDistinct({ country: applications.country }).from(applications).orderBy(asc(applications.country));
  return rows.map((r) => r.country);
}
