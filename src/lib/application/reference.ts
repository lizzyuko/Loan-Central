import { randomInt } from "node:crypto";

/**
 * Public application reference, e.g. "LC-2026-104829". Random (not
 * sequential), so references reveal nothing about volume and can't be
 * enumerated. Uniqueness is enforced by a DB unique index; callers retry on
 * collision.
 */
export function generateReference(now = new Date()): string {
  const digits = randomInt(100000, 1000000);
  return `LC-${now.getUTCFullYear()}-${digits}`;
}

export const REFERENCE_PATTERN = /^LC-\d{4}-\d{6}$/;
