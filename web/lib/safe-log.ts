// Errors and logs without secrets. Server code only (it is not marked server-only so the scripts'
// tests and the Better Auth logger can share it).
//
// Database errors carry the query and its parameters: Drizzle's DrizzleQueryError puts them in
// its message ("Failed query: … params: …"), so a failed session lookup quotes the session token,
// and a failed save quotes the note. Postgres messages and details can quote a row too. Nothing
// here ever prints a message, parameter or detail from an error: only error names and codes.
//
// Next.js also uses errors for control flow (redirect, notFound, and the "hanging promise"
// rejected when a prerender completes). Those must reach Next untouched and are never logged.
import { unstable_rethrow } from "next/navigation";

/** How far to follow wrapped errors. Real chains are 3 or 4 links long. */
const MAX_LINKS = 8;

/**
 * The error and the errors it wraps, outermost first: `cause` (the standard) and `sourceError`
 * (Neon's driver keeps the failed fetch's error there, out of `cause`'s reach). Cycle-safe.
 */
export function errorChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  const queue: unknown[] = [error];
  while (queue.length > 0 && chain.length < MAX_LINKS) {
    const link = queue.shift();
    if (link === undefined || link === null || chain.includes(link)) continue;
    chain.push(link);
    if (typeof link === "object") {
      const { cause, sourceError } = link as { cause?: unknown; sourceError?: unknown };
      queue.push(cause, sourceError);
    }
  }
  return chain;
}

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

const NAME = /^[A-Za-z][\w$]{0,63}$/;
const CODE = /^[A-Za-z0-9_.-]{1,64}$/;

function nameOf(link: unknown): string {
  if (typeof link !== "object" || link === null) return typeof link;
  const name = (link as { name?: unknown }).name;
  const ctor = (link as { constructor?: { name?: unknown } }).constructor?.name;
  // Drizzle's DrizzleQueryError keeps the name "Error"; its class name says more (when the
  // bundle kept it: minified names are short).
  if (name === "Error" && typeof ctor === "string" && ctor.length > 3 && NAME.test(ctor)) return ctor;
  return typeof name === "string" && NAME.test(name) ? name : "Error";
}

function codeOf(link: unknown): string | null {
  if (typeof link !== "object" || link === null) return null;
  // Postgres and Node errors: `code` ("42P01", "ECONNREFUSED"). Better Auth's APIError: `body.code`.
  const own = (link as { code?: unknown }).code;
  const body = (link as { body?: { code?: unknown } }).body;
  const code = own ?? (body && typeof body === "object" ? body.code : undefined);
  const text = typeof code === "number" ? String(code) : code;
  return typeof text === "string" && CODE.test(text) ? text : null;
}

/**
 * The names and codes along the error chain, for logs, for example
 * "APIError FAILED_TO_GET_SESSION < DrizzleQueryError < NeonDbError". Never a message.
 */
export function describeError(error: unknown): string {
  return errorChain(error)
    .map((link) => {
      if (link instanceof SafeError) return `SafeError(${link.detail})`;
      const code = codeOf(link);
      return code ? `${nameOf(link)} ${code}` : nameOf(link);
    })
    .join(" < ");
}

/**
 * A failure that is safe to log or to let reach Next's error handling: its message names what
 * failed plus describeError() of the original, and it keeps no reference to the original (Next
 * prints an uncaught error's whole `cause` chain).
 */
export class SafeError extends Error {
  readonly detail: string;
  constructor(what: string, error: unknown) {
    const detail = describeError(error);
    super(`${what} failed (${detail})`);
    this.name = "SafeError";
    this.detail = detail;
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

const EMAIL = /[^\s@<>"'()]+@[^\s@<>"'()]+\.[A-Za-z]{2,}/g;
// Runs of token-like characters (session tokens, signatures, cookie values). Better Auth's
// UPPER_SNAKE error codes are kept.
const TOKEN_LIKE = /[A-Za-z0-9_\-+/=.%]{20,}/g;

/**
 * A log message with anything that could be personal or secret removed: only the first line,
 * cut before any "params:", emails and token-like runs replaced, at most `max` characters.
 */
export function safeText(text: string, max = 160): string {
  let out = text.split(/\r?\n/, 1)[0] ?? "";
  const params = out.search(/params\s*:/i);
  if (params >= 0) out = out.slice(0, params);
  out = out.replace(EMAIL, "[email]").replace(TOKEN_LIKE, (run) => (/^[A-Z][A-Z0-9_]*$/.test(run) ? run : "[redacted]"));
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
