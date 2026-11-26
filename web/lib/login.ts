// Sign-in addresses and the `next` parameter. Safe to import anywhere (no server code).

/** Header the proxy sets on page requests so server code knows where the visitor was going. */
export const PATH_HEADER = "x-fde-path";

const ORIGIN = "https://app.invalid";

/**
 * Returns `value` if it is a path on this site, otherwise "/". Blocks open redirects: absolute
 * URLs, protocol-relative ("//host"), backslash tricks ("/\host"), control characters, and
 * anything that would leave the site once parsed. Also refuses /login (a loop) and /api/ paths.
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return "/";
  let url: URL;
  try {
    url = new URL(value, ORIGIN);
  } catch {
    return "/";
  }
  if (url.origin !== ORIGIN) return "/";
  const path = url.pathname;
  if (path === "/login" || path.startsWith("/login/") || path === "/api" || path.startsWith("/api/")) return "/";
  return `${path}${url.search}${url.hash}`;
}

/** The sign-in page, remembering where to go afterwards. */
export function loginHref(next: unknown): string {
  const path = safeNextPath(next);
  return path === "/" ? "/login" : `/login?next=${encodeURIComponent(path)}`;
}

/** Query value `/login?status=signed-out` set by the sign-out action. */
export const SIGNED_OUT_STATUS = "signed-out";
/** Error code for a GitHub account that is not the owner's (Better Auth adds it as `?error=`). */
export const NOT_OWNER_ERROR = "not_owner";

/** Which message the sign-in page shows (design spec section 8). */
export type LoginNotice = "not-owner" | "failed" | "signed-out" | null;

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Reads the sign-in page's query: where to go after sign-in, and which message to show. */
export function parseLoginParams(params: Params): { next: string; notice: LoginNotice } {
  const next = safeNextPath(first(params.next));
  const error = first(params.error);
  if (error) return { next, notice: error === NOT_OWNER_ERROR ? "not-owner" : "failed" };
  if (first(params.status) === SIGNED_OUT_STATUS) return { next, notice: "signed-out" };
  return { next, notice: null };
}

/** Pages anyone may open without signing in. Everything else needs the owner's sign-in. */
export function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/api/auth" || pathname.startsWith("/api/auth/");
}
