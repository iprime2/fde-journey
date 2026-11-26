// Errors and logs without secrets. Server code only (not marked server-only, so the tests and the
// Better Auth logger can share it).
//
// Database errors carry the query and its parameters: Drizzle's DrizzleQueryError puts them in
// its message ("Failed query: … params: …"), so a failed session lookup quotes the session token,
// and a failed save quotes the note. Postgres messages and details can quote a row too. Nothing
// here ever prints a message, parameter or detail from an error: only error names and codes
// (lib/error-chain.mjs, shared with the command-line scripts).
//
// Next.js also uses errors for control flow (redirect, notFound, and the "hanging promise"
// rejected when a prerender completes). Those must reach Next untouched and are never logged.
import { unstable_rethrow } from "next/navigation";
import { describeError, errorChain, isSafeName } from "./error-chain.mjs";

export { describeError, errorChain };

/**
 * Rethrows Next's own control error if it is anywhere in the chain, so Next handles it (a
 * redirect, or a prerender that has completed). `unstable_rethrow` alone follows `cause` only;
 * this also reaches errors that a library kept elsewhere. Call it first in a catch block.
 */
export function rethrowNextControl(error: unknown): void {
  for (const link of errorChain(error)) unstable_rethrow(link);
}

/** True when the chain holds one of Next's control errors (see rethrowNextControl). */
export function isNextControl(error: unknown): boolean {
  try {
    rethrowNextControl(error);
    return false;
  } catch {
    return true;
  }
}

/** Postgres error fields that name the schema object involved, never a value. */
const SCHEMA_FIELDS = ["table", "constraint", "column", "routine"] as const;
type SchemaField = (typeof SCHEMA_FIELDS)[number];

/** Only the "    at …" lines of a stack: the first line repeats the message. */
function stackFrames(link: unknown): string[] {
  const stack = link instanceof Error ? link.stack : undefined;
  return typeof stack === "string" ? stack.split("\n").filter((line) => /^\s+at /.test(line)) : [];
}

/**
 * A failure that is safe to log or to let reach Next's error handling. It keeps:
 * - a message naming what failed, plus describeError() of the original (names and codes);
 * - the innermost error's stack frames (where it really failed), without its message;
 * - Postgres's `table`, `constraint`, `column` and `routine` when they are plain identifiers.
 * It keeps no reference to the original: Next prints an uncaught error's whole `cause` chain.
 */
export class SafeError extends Error {
  readonly detail: string;
  table?: string;
  constraint?: string;
  column?: string;
  routine?: string;

  constructor(what: string, error: unknown) {
    const detail = describeError(error);
    super(`${what} failed (${detail})`);
    this.name = "SafeError";
    this.detail = detail;
    const chain = errorChain(error);
    for (const field of SCHEMA_FIELDS) {
      const value = chain.map((link) => (typeof link === "object" && link !== null ? (link as Partial<Record<SchemaField, unknown>>)[field] : undefined)).find(isSafeName);
      if (value) this[field] = value;
    }
    const innermost = [...chain].reverse().find((link) => stackFrames(link).length > 0);
    const frames = innermost ? stackFrames(innermost) : stackFrames(this);
    this.stack = [`SafeError: ${this.message}`, ...frames].join("\n");
  }
}

/**
 * Runs `work`. Next's control errors pass through untouched; any other failure becomes a
 * SafeError, so the original (and the query parameters it quotes) never travels further.
 */
export async function withSafeErrors<T>(what: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    rethrowNextControl(error);
    throw new SafeError(what, error);
  }
}

// Emails, plain or URL-encoded (owner%40example.com).
const EMAIL = /[^\s@<>"'()]+?(?:@|%40)[^\s@<>"'()%]+\.[A-Za-z]{2,}/gi;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
// Runs of token-like characters (session tokens, ids, signatures, cookie values).
const TOKEN_LIKE = /[A-Za-z0-9_\-+/=.%]{12,}/g;
// Better Auth's error codes (INTERNAL_SERVER_ERROR): words joined by "_". An all-capital random
// token has no such shape.
const ERROR_CODE = /^[A-Z][A-Z0-9]{0,15}(?:_[A-Z0-9]{1,15})+$/;
// Ordinary lowercase words and paths ("verification", "/api/auth/callback/github"): no digits,
// no capitals. Random tokens of 12 or more characters almost always have one or the other.
const PLAIN_WORDS = /^[a-z_\-/.]+$/;

/** Keeps error codes and plain lowercase words; anything else that looks like a token goes. */
function redactRun(run: string): string {
  if (ERROR_CODE.test(run)) return run;
  if (run.length < 32 && PLAIN_WORDS.test(run)) return run;
  return "[redacted]";
}

/**
 * A log message with anything that could be personal or secret removed: only the first line,
 * cut before any "params:", emails, IPv4 addresses and token-like runs replaced, at most `max`
 * characters.
 */
export function safeText(text: string, max = 160): string {
  let out = text.split(/\r?\n/, 1)[0] ?? "";
  const params = out.search(/params\s*:/i);
  if (params >= 0) out = out.slice(0, params);
  out = out.replace(EMAIL, "[email]").replace(IPV4, "[ip]").replace(TOKEN_LIKE, redactRun);
  if (out.length > max) out = `${out.slice(0, max)}…`;
  return out.trim();
}

function isErrorLike(value: unknown): boolean {
  return value instanceof Error || (typeof value === "object" && value !== null && "name" in value && "message" in value);
}

/** One part of a log line: text is cleaned, errors are described, anything else is left out. */
function logPart(part: unknown): string | null {
  if (typeof part === "string") return safeText(part) || null;
  if (typeof part === "number" || typeof part === "boolean") return String(part);
  if (isErrorLike(part)) return describeError(part);
  // Better Auth sometimes wraps the error: logger.error("…", { error })
  const inner = typeof part === "object" && part !== null ? (part as { error?: unknown }).error : undefined;
  return isErrorLike(inner) ? describeError(inner) : null;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Better Auth's `logger.log` (lib/auth.ts). Better Auth hands its logger whole errors, and its
 * default logger prints them with their messages and causes: a failed session lookup printed the
 * session token. This prints the message, cleaned, and each error's names and codes only.
 * Errors that are Next's own control flow (a prerender that completed while the session was
 * being read) are not failures and print nothing.
 */
export function betterAuthLog(level: LogLevel, message: unknown, ...args: unknown[]): void {
  const parts = [message, ...args];
  if (parts.some(isNextControl)) return;
  const line = `[Better Auth] ${level}: ${parts.map(logPart).filter(Boolean).join(" ")}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
