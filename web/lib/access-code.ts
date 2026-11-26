// The Scaler access code (M4-DESIGN 10.2). Stored only as a scrypt hash with a random salt, in
// app_setting `scaler_code_hash`; compared in constant time. Node's own crypto, no dependency.
// Pure functions (no database), safe for tests. Never log a code or a hash.
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

/** scrypt cost: N=2^15, r=8, p=1 (about 32 MB and a few tens of milliseconds per check). */
const N = 32768;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const MAX_MEMORY = 64 * 1024 * 1024;

export const ACCESS_CODE_MIN = 6;
export const ACCESS_CODE_MAX = 64;

function scrypt(code: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(code, salt, KEY_LENGTH, { N: n, r, p, maxmem: MAX_MEMORY }, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

/**
 * The form a code is compared in: surrounding spaces removed, Unicode normalised (NFKC) and upper
 * case, so "scaler-2026 " and "SCALER-2026" are the same code. Returns null for anything that
 * isn't a code (wrong type or length).
 */
export function normaliseAccessCode(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 256) return null;
  const code = value.normalize("NFKC").trim().toUpperCase();
  if (code.length < ACCESS_CODE_MIN || code.length > ACCESS_CODE_MAX) return null;
  if (/[\u0000-\u001f\u007f]/.test(code)) return null;
  return code;
}

/** `scrypt$N$r$p$salt$hash` (base64url). The code itself is never stored. */
export async function hashAccessCode(code: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(code, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

const STORED = /^scrypt\$(\d{1,7})\$(\d{1,3})\$(\d{1,3})\$([A-Za-z0-9_-]{16,64})\$([A-Za-z0-9_-]{32,128})$/;

/** True when `code` matches the stored hash. Constant-time compare; false for a malformed hash. */
export async function verifyAccessCode(code: string, stored: string | null | undefined): Promise<boolean> {
  const match = typeof stored === "string" ? STORED.exec(stored) : null;
  if (!match) return false;
  const [, n, r, p, salt, hash] = match;
  const expected = Buffer.from(hash, "base64url");
  if (expected.length !== KEY_LENGTH) return false;
  const actual = await scrypt(code, Buffer.from(salt, "base64url"), Number(n), Number(r), Number(p));
  return timingSafeEqual(actual, expected);
}
