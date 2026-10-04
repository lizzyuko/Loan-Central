import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { z } from "zod";

/**
 * Password hashing with scrypt (memory-hard, built into Node; no extra
 * dependency). Stored format: "scrypt$N$r$p$saltB64$hashB64" so parameters can
 * be raised later without breaking existing hashes.
 *
 * Intentionally free of "server-only" so the seed script can use it. Never
 * import from client components.
 */

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const MAXMEM = 128 * N * R * 2;

function scrypt(password: string, salt: Buffer, keyLen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCb(password, salt, keyLen, opts, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEY_LEN, { N, r: R, p: P, maxmem: MAXMEM });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, saltB64, hashB64] = stored.split("$");
  if (alg !== "scrypt" || !n || !r || !p || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const params = { N: Number(n), r: Number(r), p: Number(p) };
  const key = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    ...params,
    maxmem: 128 * params.N * params.r * 2,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/**
 * Burns comparable CPU time when the account doesn't exist, so response time
 * doesn't reveal whether an email is registered.
 */
let dummyHash: Promise<string> | null = null;
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword("dummy-password-for-timing");
  await verifyPassword(password, await dummyHash);
  return false;
}

const COMMON = new Set(["password1234", "123456789012", "qwertyuiopas", "loancentral1", "letmein12345", "administrator"]);

export const PASSWORD_MIN = 12;

/** Length-based policy (per NIST 800-63B) plus a few obvious rejects. */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, { error: `Use at least ${PASSWORD_MIN} characters` })
  .max(128, { error: "Use 128 characters or fewer" })
  .refine((v) => !COMMON.has(v.toLowerCase()), { error: "This password is too common" })
  .refine((v) => new Set(v).size >= 4, { error: "Use a less repetitive password" });
