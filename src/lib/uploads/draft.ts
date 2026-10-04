import "server-only";
import { cookies } from "next/headers";
import { isProduction } from "@/lib/env";
import { generateToken, sha256 } from "@/lib/security/crypto";

/**
 * Pre-submission uploads are bound to an opaque, HTTP-only "upload draft"
 * cookie. Only the hash is stored with the document rows, so documents can
 * only be attached by the browser that uploaded them.
 */
export const DRAFT_COOKIE = "lc_upload_draft";
const DRAFT_TTL_SECONDS = 24 * 60 * 60;

export async function getDraftTokenHash(): Promise<string | null> {
  const token = (await cookies()).get(DRAFT_COOKIE)?.value;
  return token && token.length >= 32 ? sha256(token) : null;
}

/** Returns the existing draft hash or issues a new draft cookie. */
export async function getOrCreateDraftTokenHash(): Promise<string> {
  const existing = await getDraftTokenHash();
  if (existing) return existing;
  const token = generateToken();
  (await cookies()).set(DRAFT_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: DRAFT_TTL_SECONDS,
  });
  return sha256(token);
}

export async function clearDraftCookie(): Promise<void> {
  (await cookies()).delete(DRAFT_COOKIE);
}

/** Cloudinary folder for a draft (derived from the hash; reveals nothing). */
export function draftFolder(draftHash: string): string {
  return `loan-central/drafts/${draftHash.slice(0, 24)}`;
}

export function applicationFolder(applicationId: string): string {
  return `loan-central/applications/${applicationId}`;
}
