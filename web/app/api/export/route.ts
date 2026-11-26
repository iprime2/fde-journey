// The Claude export (PLAN 5 and 12): read-only JSON of ONE user's sections and progress, for a
// Claude session. Authenticated by that user's export key only, never a cookie:
//
//   curl -H "Authorization: Bearer fdej_…" https://<app>/api/export
//
// - The key is looked up by its SHA-256 hash (lib/export-auth.ts). Revoked keys, unknown keys and
//   keys of users who aren't active (waitlisted, suspended, deleted; in owner-only mode anyone but
//   the owner) all get the same 401.
// - 60 requests per key per hour (429 with Retry-After after that).
// - The answer holds that user's rows only (lib/settings.ts, buildClaudeExport), never cached.
// - Logs hold names and codes only: never the key, the user or the data.
import { getDb } from "@/db/client";
import { loadAccess } from "@/lib/access";
import { claimExportKey } from "@/lib/export-auth";
import { bearerKey, hashExportKey } from "@/lib/export-token";
import { ownerGithubId } from "@/lib/owner";
import { describeError } from "@/lib/safe-log";
import { buildClaudeExport } from "@/lib/settings";
import { signupMode } from "@/lib/signup-mode";

const NO_STORE = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

function refused(): Response {
  return Response.json({ error: "A valid export key is required." }, { status: 401, headers: { ...NO_STORE, "www-authenticate": 'Bearer realm="fde-journey-export"' } });
}

export async function GET(request: Request): Promise<Response> {
  const key = bearerKey(request.headers.get("authorization"));
  if (!key) return refused();
  try {
    const db = await getDb();
    const found = await claimExportKey(db, hashExportKey(key));
    if (!found) return refused();
    if (found.limited) return Response.json({ error: "Too many requests. Try again later." }, { status: 429, headers: { ...NO_STORE, "retry-after": "3600" } });
    const access = await loadAccess(db, found.userId, ownerGithubId(process.env));
    if (!access || (!access.isOwner && (access.status !== "active" || signupMode() === "owner-only"))) return refused();
    return Response.json(await buildClaudeExport(db, found.userId, access.isOwner), { headers: NO_STORE });
  } catch (error) {
    console.error(`Export failed (${describeError(error)})`);
    return Response.json({ error: "The export didn't work. Try again." }, { status: 500, headers: NO_STORE });
  }
}
