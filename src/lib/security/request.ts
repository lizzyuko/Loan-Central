import "server-only";
import { headers } from "next/headers";
import { appUrl } from "@/lib/env";
import { hashIp } from "./crypto";

export interface RequestContext {
  ip: string | null;
  ipHash: string | null;
  userAgent: string | null;
}

function firstIp(forwardedFor: string | null): string | null {
  const ip = forwardedFor?.split(",")[0]?.trim();
  return ip || null;
}

/** Client IP + UA for the current request (Vercel sets x-forwarded-for). */
export async function getRequestContext(): Promise<RequestContext> {
  const h = await headers();
  const ip = firstIp(h.get("x-forwarded-for")) ?? h.get("x-real-ip");
  const userAgent = h.get("user-agent")?.slice(0, 400) ?? null;
  return { ip, ipHash: hashIp(ip), userAgent };
}

/**
 * CSRF defence for route handlers that change state (server actions already
 * get Next's built-in Origin check).
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const o = new URL(origin);
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (host && o.host === host) return true;
    return o.origin === new URL(appUrl()).origin;
  } catch {
    return false;
  }
}

/**
 * Only allow same-site relative redirects (prevents open redirects).
 */
export function safeRedirectPath(path: string | null | undefined, fallback: string): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return fallback;
  return path;
}
