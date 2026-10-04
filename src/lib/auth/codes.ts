import "server-only";
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { adminVerificationCodes, applicantVerificationCodes } from "@/db/schema";
import { generateNumericCode, generateToken, hmac, safeEqual, sha256 } from "@/lib/security/crypto";

/**
 * One-time verification codes (6 digits) + magic-link tokens.
 * - stored only as keyed hashes; never logged
 * - expire after CODE_TTL_MINUTES, single use, MAX_ATTEMPTS wrong guesses
 * - issuing a new code invalidates any outstanding ones
 */

export type CodeKind = "admin" | "applicant";

export const CODE_TTL_MINUTES = 10;
export const MAX_ATTEMPTS = 5;

const tables = {
  admin: { table: adminVerificationCodes, userColumn: adminVerificationCodes.adminId },
  applicant: { table: applicantVerificationCodes, userColumn: applicantVerificationCodes.applicantId },
} as const;

export function hashCode(kind: CodeKind, userId: string, code: string): string {
  return hmac("verification-code", kind, userId, code);
}

export interface IssuedCode {
  code: string;
  linkToken: string;
}

export async function issueCode(kind: CodeKind, userId: string, opts: { ipHash: string | null; redirectPath?: string | null }): Promise<IssuedCode> {
  const { table, userColumn } = tables[kind];
  const code = generateNumericCode(6);
  const linkToken = generateToken();
  const now = new Date();
  const db = getDb();

  await db.transaction(async (tx) => {
    // Invalidate outstanding codes for this user.
    await tx.update(table).set({ consumedAt: now }).where(and(eq(userColumn, userId), isNull(table.consumedAt)));
    const values = {
      codeHash: hashCode(kind, userId, code),
      linkTokenHash: sha256(linkToken),
      expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60_000),
      ipHash: opts.ipHash,
    };
    if (kind === "admin") await tx.insert(adminVerificationCodes).values({ ...values, adminId: userId });
    else await tx.insert(applicantVerificationCodes).values({ ...values, applicantId: userId, redirectPath: opts.redirectPath ?? null });
  });
  return { code, linkToken };
}

export type VerifyFailure = "invalid" | "expired" | "too_many_attempts";
export type VerifyResult = { ok: true; userId: string; redirectPath: string | null } | { ok: false; reason: VerifyFailure };

/** Verify a typed 6-digit code for a known user. */
export async function verifyCode(kind: CodeKind, userId: string, code: string): Promise<VerifyResult> {
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: "invalid" };
  const { table, userColumn } = tables[kind];
  const db = getDb();

  const [row] = await db
    .select({ id: table.id, codeHash: table.codeHash, expiresAt: table.expiresAt, attempts: table.attempts })
    .from(table)
    .where(and(eq(userColumn, userId), isNull(table.consumedAt)))
    .orderBy(desc(table.createdAt))
    .limit(1);

  if (!row) return { ok: false, reason: "invalid" };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };

  if (!safeEqual(row.codeHash, hashCode(kind, userId, code))) {
    const [updated] = await db
      .update(table)
      .set({ attempts: sql`${table.attempts} + 1` })
      .where(eq(table.id, row.id))
      .returning({ attempts: table.attempts });
    // Burn the code once attempts are exhausted.
    if (updated && updated.attempts >= MAX_ATTEMPTS) {
      await db.update(table).set({ consumedAt: new Date() }).where(eq(table.id, row.id));
      return { ok: false, reason: "too_many_attempts" };
    }
    return { ok: false, reason: "invalid" };
  }
  return consume(kind, row.id, userId);
}

/** Verify a magic-link token (high entropy, so looked up by hash). */
export async function verifyLinkToken(kind: CodeKind, token: string): Promise<VerifyResult> {
  if (!token || token.length < 32 || token.length > 128) return { ok: false, reason: "invalid" };
  const { table, userColumn } = tables[kind];
  const [row] = await getDb()
    .select({ id: table.id, userId: userColumn, expiresAt: table.expiresAt, attempts: table.attempts, consumedAt: table.consumedAt })
    .from(table)
    .where(eq(table.linkTokenHash, sha256(token)))
    .limit(1);
  if (!row || row.consumedAt) return { ok: false, reason: "invalid" };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };
  return consume(kind, row.id, row.userId);
}

/** Atomically mark a code used; fails if another request consumed it first. */
async function consume(kind: CodeKind, id: string, userId: string): Promise<VerifyResult> {
  const { table } = tables[kind];
  const updated = await getDb()
    .update(table)
    .set({ consumedAt: new Date() })
    .where(and(eq(table.id, id), isNull(table.consumedAt)))
    .returning({ id: table.id });
  if (updated.length === 0) return { ok: false, reason: "invalid" };

  let redirectPath: string | null = null;
  if (kind === "applicant") {
    const [r] = await getDb()
      .select({ redirectPath: applicantVerificationCodes.redirectPath })
      .from(applicantVerificationCodes)
      .where(eq(applicantVerificationCodes.id, id));
    redirectPath = r?.redirectPath ?? null;
  }
  return { ok: true, userId, redirectPath };
}

/** Housekeeping: delete codes that expired over a day ago. */
export async function purgeExpiredCodes(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await getDb().delete(adminVerificationCodes).where(lt(adminVerificationCodes.expiresAt, cutoff));
  await getDb().delete(applicantVerificationCodes).where(lt(applicantVerificationCodes.expiresAt, cutoff));
}

export const VERIFY_MESSAGES: Record<VerifyFailure, string> = {
  invalid: "That code isn't valid. Check it and try again, or request a new one.",
  expired: "That code has expired. Please request a new one.",
  too_many_attempts: "Too many incorrect attempts. Please request a new code.",
};
