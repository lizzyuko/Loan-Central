import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/db";
import { admins, adminTokens, applicants, applicantTokens } from "@/db/schema";
import { generateToken, sha256 } from "@/lib/security/crypto";

/**
 * Invitation and password-reset tokens for admins and applicants.
 * 256-bit random, stored as SHA-256, single-use, short-lived. Issuing a new
 * token of the same purpose invalidates earlier unused ones.
 */

export type AccountKind = "admin" | "applicant";
export type TokenPurpose = "INVITE" | "PASSWORD_RESET";

export const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  INVITE: 7 * 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 30 * 60 * 1000,
};

const T = {
  admin: { table: adminTokens, owner: adminTokens.adminId },
  applicant: { table: applicantTokens, owner: applicantTokens.applicantId },
} as const;

export async function issueToken(kind: AccountKind, userId: string, purpose: TokenPurpose, createdByAdminId: string | null, db: DbOrTx = getDb()): Promise<string> {
  const { table, owner } = T[kind];
  const token = generateToken();
  const now = new Date();
  await db
    .update(table)
    .set({ consumedAt: now })
    .where(and(eq(owner, userId), eq(table.purpose, purpose), isNull(table.consumedAt)));
  const values = { purpose, tokenHash: sha256(token), expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[purpose]), createdByAdminId };
  if (kind === "admin") await db.insert(adminTokens).values({ ...values, adminId: userId });
  else await db.insert(applicantTokens).values({ ...values, applicantId: userId });
  return token;
}

function validToken(kind: AccountKind, purpose: TokenPurpose, token: string) {
  const { table } = T[kind];
  return and(eq(table.tokenHash, sha256(token)), eq(table.purpose, purpose), isNull(table.consumedAt), gt(table.expiresAt, new Date()));
}

const plausible = (token: string) => token.length >= 32 && token.length <= 128;

/** Look up a token without consuming it (to render the set-password page). */
export async function inspectToken(kind: AccountKind, purpose: TokenPurpose, token: string): Promise<{ userId: string; email: string; name: string } | null> {
  if (!plausible(token)) return null;
  const db = getDb();
  if (kind === "admin") {
    const [row] = await db
      .select({ userId: admins.id, email: admins.email, name: admins.name, isActive: admins.isActive })
      .from(adminTokens)
      .innerJoin(admins, eq(admins.id, adminTokens.adminId))
      .where(validToken(kind, purpose, token))
      .limit(1);
    return row?.isActive ? { userId: row.userId, email: row.email, name: row.name } : null;
  }
  const [row] = await db
    .select({ userId: applicants.id, email: applicants.email, name: applicants.firstName })
    .from(applicantTokens)
    .innerJoin(applicants, eq(applicants.id, applicantTokens.applicantId))
    .where(validToken(kind, purpose, token))
    .limit(1);
  return row ?? null;
}

/** Atomically consume a token; returns the user id, or null if invalid/used/expired. */
export async function consumeToken(kind: AccountKind, purpose: TokenPurpose, token: string, db: DbOrTx = getDb()): Promise<string | null> {
  if (!plausible(token)) return null;
  const { table, owner } = T[kind];
  const [row] = await db.update(table).set({ consumedAt: new Date() }).where(validToken(kind, purpose, token)).returning({ userId: owner });
  return row?.userId ?? null;
}
