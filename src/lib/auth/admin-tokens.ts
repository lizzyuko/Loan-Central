import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/db";
import { admins, adminTokens } from "@/db/schema";
import { generateToken, sha256 } from "@/lib/security/crypto";

/**
 * Invitation and password-reset tokens. 256-bit random, stored as SHA-256,
 * single-use, short-lived. Issuing a new token of the same purpose
 * invalidates earlier unused ones.
 */

export type AdminTokenPurpose = "INVITE" | "PASSWORD_RESET";

export const TOKEN_TTL_MS: Record<AdminTokenPurpose, number> = {
  INVITE: 7 * 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 30 * 60 * 1000,
};

export async function issueAdminToken(adminId: string, purpose: AdminTokenPurpose, createdByAdminId: string | null, db: DbOrTx = getDb()): Promise<string> {
  const token = generateToken();
  const now = new Date();
  await db
    .update(adminTokens)
    .set({ consumedAt: now })
    .where(and(eq(adminTokens.adminId, adminId), eq(adminTokens.purpose, purpose), isNull(adminTokens.consumedAt)));
  await db.insert(adminTokens).values({
    adminId,
    purpose,
    tokenHash: sha256(token),
    expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[purpose]),
    createdByAdminId,
  });
  return token;
}

function validToken(purpose: AdminTokenPurpose, token: string) {
  return and(
    eq(adminTokens.tokenHash, sha256(token)),
    eq(adminTokens.purpose, purpose),
    isNull(adminTokens.consumedAt),
    gt(adminTokens.expiresAt, new Date()),
  );
}

const plausible = (token: string) => token.length >= 32 && token.length <= 128;

/** Look up a token without consuming it (to render the set-password page). */
export async function inspectAdminToken(purpose: AdminTokenPurpose, token: string) {
  if (!plausible(token)) return null;
  const [row] = await getDb()
    .select({ adminId: admins.id, email: admins.email, name: admins.name, isActive: admins.isActive })
    .from(adminTokens)
    .innerJoin(admins, eq(admins.id, adminTokens.adminId))
    .where(validToken(purpose, token))
    .limit(1);
  return row && row.isActive ? row : null;
}

/** Atomically consume a token; returns the admin id, or null if invalid/used/expired. */
export async function consumeAdminToken(purpose: AdminTokenPurpose, token: string, db: DbOrTx = getDb()): Promise<string | null> {
  if (!plausible(token)) return null;
  const [row] = await db.update(adminTokens).set({ consumedAt: new Date() }).where(validToken(purpose, token)).returning({ adminId: adminTokens.adminId });
  return row?.adminId ?? null;
}
