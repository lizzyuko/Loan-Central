import "server-only";
import { NextResponse } from "next/server";
import { ConfigurationError } from "@/lib/env";
import { logger } from "@/lib/security/logger";

export function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Map unexpected errors to safe, generic responses (details only in logs). */
export function handleRouteError(err: unknown, context: string) {
  if (err instanceof ConfigurationError) {
    logger.error(`${context}: service not configured`, { message: err.message });
    return jsonError(503, "This feature is temporarily unavailable. Please try again later.");
  }
  logger.error(`${context} failed`, { err });
  return jsonError(500, "Something went wrong. Please try again.");
}
