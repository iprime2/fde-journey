// Claude export keys (`/api/export`). A key is 32 random bytes with a recognisable prefix; only its
// SHA-256 hash is stored (export_token.token_hash), so a database leak doesn't leak working keys.
// A plain hash is enough here: the key is random and long, so there is nothing to guess.
// Pure functions, safe for tests. Never log a key.
import { createHash, randomBytes } from "node:crypto";

export const EXPORT_KEY_PREFIX = "fdej_";
const KEY = /^fdej_[A-Za-z0-9_-]{43}$/;

/** A new key. Show it once; store hashExportKey(key). */
export function newExportKey(): string {
  return `${EXPORT_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashExportKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** The key from an `Authorization: Bearer …` header, or null if there is none or it isn't a key. */
export function bearerKey(header: string | null): string | null {
  if (!header || header.length > 200) return null;
  const match = /^Bearer[ ]+(\S+)$/i.exec(header.trim());
  return match && KEY.test(match[1]) ? match[1] : null;
}
