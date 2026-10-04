import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { adminSessions, applicantSessions } from "@/db/schema";
import { isProduction } from "@/lib/env";
import { generateToken, sha256 } from "@/lib/security/crypto";
import type { RequestContext } from "@/lib/security/request";

/**
 * Database-backed sessions. The browser holds a random 256-bit token in an
 * HTTP-only cookie; only its SHA-256 hash is stored. Sessions have an absolute
 * lifetime and an idle timeout that slides on activity, and can be revoked.
 */

export type SessionKind = "admin" | "applicant";

interface KindConfig {
  cookie: string;
  absoluteMs: number;
  idleMs: number;
}

export const SESSION_CONFIG: Record<SessionKind, KindConfig> = {
  admin: { cookie: "lc_admin_session", absoluteMs: 12 * 60 * 60 * 1000, idleMs: 2 * 60 * 60 * 1000 },
  applicant: { cookie: "lc_applicant_session", absoluteMs: 2 * 60 * 60 * 1000, idleMs: 30 * 60 * 1000 },
};

/** Only refresh the idle window if it was last extended more than this long ago. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

const tables = {
  admin: { table: adminSessions, userColumn: adminSessions.adminId },
  applicant: { table: applicantSessions, userColumn: applicantSessions.applicantId },
} as const;

export interface ActiveSession {
  sessionId: string;
  userId: string;
  expiresAt: Date;
}

export async function createSession(kind: SessionKind, userId: string, ctx: RequestContext): Promise<void> {
  const cfg = SESSION_CONFIG[kind];
  const token = generateToken();
  const now = Date.now();
  const expiresAt = new Date(now + cfg.absoluteMs);
  const idleExpiresAt = new Date(now + cfg.idleMs);
  const common = { tokenHash: sha256(token), expiresAt, idleExpiresAt, ipHash: ctx.ipHash, userAgent: ctx.userAgent };

  if (kind === "admin") await getDb().insert(adminSessions).values({ ...common, adminId: userId });
  else await getDb().insert(applicantSessions).values({ ...common, applicantId: userId });

  (await cookies()).set(cfg.cookie, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Validates the session cookie against the DB. Returns null if invalid/expired. */
export async function readSession(kind: SessionKind): Promise<ActiveSession | null> {
  const cfg = SESSION_CONFIG[kind];
  const token = (await cookies()).get(cfg.cookie)?.value;
  if (!token || token.length < 32 || token.length > 128) return null;

  const { table, userColumn } = tables[kind];
  const now = new Date();
  const [row] = await getDb()
    .select({ id: table.id, userId: userColumn, expiresAt: table.expiresAt, idleExpiresAt: table.idleExpiresAt })
    .from(table)
    .where(and(eq(table.tokenHash, sha256(token)), isNull(table.revokedAt), gt(table.expiresAt, now), gt(table.idleExpiresAt, now)))
    .limit(1);
  if (!row) return null;

  // Slide the idle window (bounded by the absolute expiry), at most every few minutes.
  const nextIdle = new Date(Math.min(now.getTime() + cfg.idleMs, row.expiresAt.getTime()));
  if (nextIdle.getTime() - row.idleExpiresAt.getTime() > TOUCH_INTERVAL_MS) {
    await getDb().update(table).set({ idleExpiresAt: nextIdle }).where(eq(table.id, row.id));
  }
  return { sessionId: row.id, userId: row.userId, expiresAt: row.expiresAt };
}

export async function destroySession(kind: SessionKind): Promise<void> {
  const cfg = SESSION_CONFIG[kind];
  const jar = await cookies();
  const token = jar.get(cfg.cookie)?.value;
  if (token) {
    const { table } = tables[kind];
    await getDb().update(table).set({ revokedAt: new Date() }).where(eq(table.tokenHash, sha256(token)));
  }
  jar.delete(cfg.cookie);
}

/** Revoke every session for a user (e.g. admin deactivated). */
export async function revokeAllSessions(kind: SessionKind, userId: string): Promise<void> {
  const { table, userColumn } = tables[kind];
  await getDb().update(table).set({ revokedAt: new Date() }).where(and(eq(userColumn, userId), isNull(table.revokedAt)));
}
