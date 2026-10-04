import "server-only";
import { lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rateLimits } from "@/db/schema";
import { logger } from "./logger";

/**
 * Fixed-window rate limiting stored in Postgres (one upsert per check), so no
 * extra service is needed. Keys passed in should already be pseudonymous
 * (hashed email / hashed IP).
 */
export const RATE_LIMITS = {
  loginByEmail: { limit: 10, windowSeconds: 15 * 60 },
  loginByIp: { limit: 30, windowSeconds: 15 * 60 },
  passwordResetByEmail: { limit: 3, windowSeconds: 60 * 60 },
  passwordResetByIp: { limit: 10, windowSeconds: 60 * 60 },
  tokenRedeemByIp: { limit: 20, windowSeconds: 15 * 60 },
  applicationSubmitByIp: { limit: 5, windowSeconds: 60 * 60 },
  uploadByIp: { limit: 40, windowSeconds: 60 * 60 },
  portalActionByApplicant: { limit: 30, windowSeconds: 10 * 60 },
  adminSensitiveByAdmin: { limit: 30, windowSeconds: 10 * 60 },
} as const satisfies Record<string, { limit: number; windowSeconds: number }>;

export type RateLimitPolicy = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  success: boolean;
  retryAfterSeconds: number;
}

/** Start of the fixed window containing `nowMs`. */
export function windowStart(nowMs: number, windowSeconds: number): number {
  const span = windowSeconds * 1000;
  return Math.floor(nowMs / span) * span;
}

export async function rateLimit(policy: RateLimitPolicy, key: string): Promise<RateLimitResult> {
  const { limit, windowSeconds } = RATE_LIMITS[policy];
  const now = Date.now();
  const start = windowStart(now, windowSeconds);
  try {
    const [row] = await getDb()
      .insert(rateLimits)
      .values({ key: `${policy}:${key}`, windowStart: new Date(start), count: 1 })
      .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
      .returning({ count: rateLimits.count });
    const count = row?.count ?? 1;
    if (count <= limit) return { success: true, retryAfterSeconds: 0 };
    return { success: false, retryAfterSeconds: Math.max(1, Math.ceil((start + windowSeconds * 1000 - now) / 1000)) };
  } catch (err) {
    // Fail closed: if we can't count, we don't allow the abuse-prone action.
    logger.error("Rate limiter error", { policy, err });
    return { success: false, retryAfterSeconds: 30 };
  }
}

/** Check several limits; fails if any fails. All are counted. */
export async function rateLimitAll(checks: Array<[RateLimitPolicy, string | null | undefined]>): Promise<RateLimitResult> {
  const results = await Promise.all(
    checks.filter((c): c is [RateLimitPolicy, string] => Boolean(c[1])).map(([policy, key]) => rateLimit(policy, key)),
  );
  const failed = results.filter((r) => !r.success);
  if (failed.length === 0) return { success: true, retryAfterSeconds: 0 };
  return { success: false, retryAfterSeconds: Math.max(...failed.map((r) => r.retryAfterSeconds)) };
}

/** Housekeeping: drop counters older than the longest window. */
export async function purgeOldRateLimits(): Promise<void> {
  await getDb().delete(rateLimits).where(lt(rateLimits.windowStart, new Date(Date.now() - 2 * 60 * 60 * 1000)));
}
