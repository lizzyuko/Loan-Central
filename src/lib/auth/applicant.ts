import "server-only";
import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { applicants, applications } from "@/db/schema";
import { readSession } from "./session";

export interface CurrentApplicant {
  id: string;
  email: string;
  firstName: string;
  sessionId: string;
}

export const getCurrentApplicant = cache(async (): Promise<CurrentApplicant | null> => {
  const session = await readSession("applicant");
  if (!session) return null;
  const [row] = await getDb()
    .select({ id: applicants.id, email: applicants.email, firstName: applicants.firstName })
    .from(applicants)
    .where(eq(applicants.id, session.userId))
    .limit(1);
  return row ? { ...row, sessionId: session.sessionId } : null;
});

export async function requireApplicantPage(): Promise<CurrentApplicant> {
  const applicant = await getCurrentApplicant();
  if (!applicant) redirect("/portal/login?expired=1");
  return applicant;
}

export async function requireApplicant(): Promise<CurrentApplicant> {
  const applicant = await getCurrentApplicant();
  if (!applicant) throw new Error("unauthenticated");
  return applicant;
}

/**
 * Ownership check: returns the application only if it belongs to the
 * signed-in applicant. Knowing an application id is never sufficient.
 */
export async function getOwnedApplicationId(applicantId: string, applicationId: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(applicationId)) return null;
  const [row] = await getDb()
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.id, applicationId), eq(applications.applicantId, applicantId)))
    .limit(1);
  return row?.id ?? null;
}
