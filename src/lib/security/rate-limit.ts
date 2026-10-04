import "server-only";
import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { isProduction, upstashConfig } from "@/lib/env";
import { logger } from "./logger";

/**
 * Named rate-limit policies. Keys passed to `rateLimit()` should already be
 * pseudonymous (hashed email / hashed IP).
 */
export const RATE_LIMITS = {
  authRequestByEmail: { limit: 5, window: "15 m" },
  authRequestByIp: { limit: 20, window: "15 m" },
  authVerifyByIp: { limit: 15, window: "15 m" },
  applicationSubmitByIp: { limit: 5, window: "1 h" },
  uploadByIp: { limit: 40, window: "1 h" },
  portalActionByApplicant: { limit: 30, window: "10 m" },
  adminSensitiveByAdmin: { limit: 30, window: "10 m" },
} as const satisfies Record<string, { limit: number; window: Duration }>;

export type RateLimitPolicy = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  success: boolean;
  retryAfterSeconds: number;
}

// --- Upstash (production) ---------------------------------------------------

const limiters = new Map<RateLimitPolicy, Ratelimit>();
let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis === undefined) {
    const cfg = upstashConfig();
    redis = cfg ? new Redis(cfg) : null;
  }
  return redis;
}

function getLimiter(policy: RateLimitPolicy): Ratelimit | null {
  const client = getRedis();
  if (!client) return null;
  let limiter = limiters.get(policy);
  if (!limiter) {
    const { limit, window } = RATE_LIMITS[policy];
    limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: `lc:rl:${policy}`,
      analytics: false,
    });
    limiters.set(policy, limiter);
  }
  return limiter;
}

// --- In-memory (development only) -------------------------------------------

const memory = new Map<string, number[]>();

function windowMs(window: Duration): number {
  const [n, unit] = window.split(" ") as [string, string];
  const mult: Record<string, number> = { ms: 1, s: 1e3, m: 6e4, h: 36e5, d: 864e5 };
  return Number(n) * (mult[unit] ?? 6e4);
}

function memoryLimit(policy: RateLimitPolicy, key: string): RateLimitResult {
  const { limit, window } = RATE_LIMITS[policy];
  const span = windowMs(window);
  const now = Date.now();
  const k = `${policy}:${key}`;
  const hits = (memory.get(k) ?? []).filter((t) => now - t < span);
  if (hits.length >= limit) {
    const oldest = hits[0] ?? now;
    memory.set(k, hits);
    return { success: false, retryAfterSeconds: Math.ceil((oldest + span - now) / 1000) };
  }
  hits.push(now);
  memory.set(k, hits);
  return { success: true, retryAfterSeconds: 0 };
}

export async function rateLimit(policy: RateLimitPolicy, key: string): Promise<RateLimitResult> {
  const limiter = getLimiter(policy);
  if (!limiter) {
    if (isProduction) {
      // Fail closed: running without a shared limiter in production is unsafe.
      logger.error("Rate limiter not configured in production", { policy });
      return { success: false, retryAfterSeconds: 60 };
    }
    return memoryLimit(policy, key);
  }
  try {
    const res = await limiter.limit(key);
    return {
      success: res.success,
      retryAfterSeconds: res.success ? 0 : Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
    };
  } catch (err) {
    logger.error("Rate limiter error", { policy, err });
    return { success: false, retryAfterSeconds: 30 };
  }
}

/** Check several limits; fails if any fails. All are counted. */
export async function rateLimitAll(
  checks: Array<[RateLimitPolicy, string | null | undefined]>,
): Promise<RateLimitResult> {
  const results = await Promise.all(
    checks
      .filter((c): c is [RateLimitPolicy, string] => Boolean(c[1]))
      .map(([policy, key]) => rateLimit(policy, key)),
  );
  const failed = results.filter((r) => !r.success);
  if (failed.length === 0) return { success: true, retryAfterSeconds: 0 };
  return { success: false, retryAfterSeconds: Math.max(...failed.map((r) => r.retryAfterSeconds)) };
}

export const __test = { memoryLimit, memory };
