// Error chains for logs, shared by the app (lib/safe-log.ts) and the command-line scripts
// (scripts/lib/db.mjs). Plain JavaScript, so `node scripts/…` imports it without a build step.
//
// Only names and codes leave this module, never a message: a failed query's message quotes its
// parameters (session tokens, note text), and Postgres messages and details can quote the row.

/** How far to follow wrapped errors. Real chains are 3 or 4 links long. */
const MAX_LINKS = 8;
const NAME = /^[A-Za-z][\w$]{0,63}$/;
const CODE = /^[A-Za-z0-9_.-]{1,64}$/;

/**
 * True for a plain identifier (an error name, a table or column name): safe to print.
 * @param {unknown} value
 * @returns {value is string}
 */
export function isSafeName(value) {
  return typeof value === "string" && NAME.test(value);
}

/**
 * The error and the errors it wraps, outermost first: `cause` (the standard) and `sourceError`
 * (Neon's driver keeps the failed fetch's error there, out of `cause`'s reach). Cycle-safe.
 * @param {unknown} error
 * @returns {unknown[]}
 */
export function errorChain(error) {
  /** @type {unknown[]} */
  const chain = [];
  const queue = [error];
  while (queue.length > 0 && chain.length < MAX_LINKS) {
    const link = queue.shift();
    if (link === undefined || link === null || chain.includes(link)) continue;
    chain.push(link);
    if (typeof link === "object") {
      const { cause, sourceError } = /** @type {{ cause?: unknown, sourceError?: unknown }} */ (link);
      queue.push(cause, sourceError);
    }
  }
  return chain;
}

/**
 * @param {unknown} link
 * @returns {string}
 */
function nameOf(link) {
  if (typeof link !== "object" || link === null) return typeof link;
  const { name } = /** @type {{ name?: unknown }} */ (link);
  const ctor = /** @type {{ constructor?: { name?: unknown } }} */ (link).constructor?.name;
  // Drizzle's DrizzleQueryError keeps the name "Error"; its class name says more (when the
  // bundle kept it: minified names are short).
  if (name === "Error" && typeof ctor === "string" && ctor.length > 3 && isSafeName(ctor)) return ctor;
  return isSafeName(name) ? name : "Error";
}

/**
 * Postgres and Node errors: `code` ("42P01", "ECONNREFUSED"). Better Auth's APIError: `body.code`.
 * @param {unknown} link
 * @returns {string | null}
 */
function codeOf(link) {
  if (typeof link !== "object" || link === null) return null;
  const { code: own, body } = /** @type {{ code?: unknown, body?: { code?: unknown } }} */ (link);
  const code = own ?? (body && typeof body === "object" ? body.code : undefined);
  const text = typeof code === "number" ? String(code) : code;
  return typeof text === "string" && CODE.test(text) ? text : null;
}

/**
 * The names and codes along the error chain, for example
 * "APIError FAILED_TO_GET_SESSION < DrizzleQueryError < NeonDbError". Never a message.
 * A SafeError (lib/safe-log.ts) shows the description it was made with.
 * @param {unknown} error
 * @returns {string}
 */
export function describeError(error) {
  const parts = errorChain(error).map((link) => {
    if (link instanceof Error && link.name === "SafeError" && typeof (/** @type {{ detail?: unknown }} */ (link).detail) === "string") {
      return `SafeError(${/** @type {{ detail: string }} */ (link).detail})`;
    }
    const code = codeOf(link);
    return code ? `${nameOf(link)} ${code}` : nameOf(link);
  });
  return parts.join(" < ") || "unknown";
}
