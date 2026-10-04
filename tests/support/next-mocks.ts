import { vi } from "vitest";

/**
 * Minimal stand-ins for Next.js request APIs so server code can run in Vitest.
 * Each test can swap the cookie jar to simulate different browsers/users.
 */
export const cookieJar = new Map<string, string>();
export const deferred: Array<() => unknown> = [];

export function asBrowser(cookies: Record<string, string> = {}) {
  cookieJar.clear();
  for (const [k, v] of Object.entries(cookies)) cookieJar.set(k, v);
}

export function snapshotCookies(): Record<string, string> {
  return Object.fromEntries(cookieJar);
}

export async function flushAfter() {
  while (deferred.length) await deferred.shift()!();
}

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    has: (name: string) => cookieJar.has(name),
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name),
  }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "vitest" }),
}));

vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (fn: () => unknown) => void deferred.push(fn),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined, refresh: () => undefined }));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

// Turnstile: "bad-token" fails, anything else passes (no network in tests).
vi.mock("@/lib/turnstile/verify", () => ({
  verifyTurnstile: async ({ token }: { token: string | null }) =>
    token && token !== "bad-token" ? { success: true } : { success: false, reason: "invalid" },
}));
