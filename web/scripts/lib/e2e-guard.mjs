// Safety checks for the end-to-end sign-in seed (scripts/e2e-seed.mjs). The seed writes a test
// owner and a session straight into a local PGlite folder, so Playwright can sign in without
// GitHub. It must be impossible to point it at anything real, so it refuses unless every check
// passes. Pure function, unit-tested in tests/unit/e2e-guard.test.ts.
import path from "node:path";
import { WEB_DIR } from "./db.mjs";
import { E2E_USERS } from "./e2e-data.mjs";

const TOKEN = /^[A-Za-z0-9_-]{32,128}$/;
const MAX_SPARE_TOKENS = 64;
const MAX_USER_TOKENS = 128;

/**
 * @param {Record<string, string | undefined>} env
 * @param {string} [webDir]
 * @returns {{ ok: true, dataDir: string, token: string, spareTokens: string[], userTokens: { user: string, token: string }[], exportKeyHash: string | null, ownerId: string } | { ok: false, reason: string }}
 */
export function checkE2eSeedEnv(env, webDir = WEB_DIR) {
  if (env.E2E_AUTH !== "1") return { ok: false, reason: "E2E_AUTH=1 is required." };
  if (env.VERCEL) return { ok: false, reason: "Refusing to run on Vercel." };
  if (env.DATABASE_URL?.trim()) return { ok: false, reason: "DATABASE_URL is set. The seed only writes to a local PGlite folder." };

  const dirSetting = env.PGLITE_DIR?.trim();
  if (!dirSetting) return { ok: false, reason: "PGLITE_DIR must name the test database folder." };
  const dataRoot = path.join(webDir, ".data");
  const dataDir = path.resolve(webDir, dirSetting);
  const inside = path.relative(dataRoot, dataDir);
  if (!inside || inside.startsWith("..") || path.isAbsolute(inside) || inside.includes(path.sep)) {
    return { ok: false, reason: "PGLITE_DIR must be a folder directly inside web/.data/." };
  }
  if (!path.basename(dataDir).startsWith("pglite-e2e")) {
    return { ok: false, reason: "PGLITE_DIR must start with pglite-e2e, so the development database is never touched." };
  }

  const token = env.E2E_SESSION_TOKEN ?? "";
  if (!TOKEN.test(token)) return { ok: false, reason: "E2E_SESSION_TOKEN must be 32 to 128 letters, digits, - or _." };
  // Optional: more sessions for the same test owner, for tests that sign out (comma-separated).
  const spareSetting = env.E2E_SPARE_SESSION_TOKENS?.trim() ?? "";
  const spareTokens = spareSetting ? spareSetting.split(",") : [];
  if (spareTokens.length > MAX_SPARE_TOKENS) return { ok: false, reason: `E2E_SPARE_SESSION_TOKENS holds at most ${MAX_SPARE_TOKENS} tokens.` };
  if (!spareTokens.every((t) => TOKEN.test(t))) {
    return { ok: false, reason: "E2E_SPARE_SESSION_TOKENS must be comma-separated tokens of 32 to 128 letters, digits, - or _." };
  }
  if (new Set([token, ...spareTokens]).size !== spareTokens.length + 1) {
    return { ok: false, reason: "E2E_SPARE_SESSION_TOKENS must not repeat a token or E2E_SESSION_TOKEN." };
  }
  // Optional (M4b): sessions for the made-up users in scripts/lib/e2e-data.mjs, as `user:token`.
  const userSetting = env.E2E_USER_SESSION_TOKENS?.trim() ?? "";
  const userEntries = userSetting ? userSetting.split(",") : [];
  if (userEntries.length > MAX_USER_TOKENS) return { ok: false, reason: `E2E_USER_SESSION_TOKENS holds at most ${MAX_USER_TOKENS} entries.` };
  const userTokens = [];
  for (const entry of userEntries) {
    const [user, userToken, ...rest] = entry.split(":");
    if (rest.length > 0 || !Object.hasOwn(E2E_USERS, user) || !TOKEN.test(userToken ?? "")) {
      return { ok: false, reason: "E2E_USER_SESSION_TOKENS must be comma-separated user:token pairs for the made-up test users." };
    }
    userTokens.push({ user, token: userToken });
  }
  const allTokens = [token, ...spareTokens, ...userTokens.map((t) => t.token)];
  if (new Set(allTokens).size !== allTokens.length) return { ok: false, reason: "E2E_USER_SESSION_TOKENS must not repeat a token." };
  // Optional (M4b): the SHA-256 of the made-up active user's export key.
  const exportKeyHash = env.E2E_EXPORT_KEY_HASH?.trim() || null;
  if (exportKeyHash !== null && !/^[0-9a-f]{64}$/.test(exportKeyHash)) return { ok: false, reason: "E2E_EXPORT_KEY_HASH must be 64 hexadecimal characters." };

  const ownerId = env.OWNER_GITHUB_ID?.trim() ?? "";
  if (!/^[1-9]\d{0,19}$/.test(ownerId)) return { ok: false, reason: "OWNER_GITHUB_ID must be a number." };
  if (Object.values(E2E_USERS).some((u) => u.githubId === ownerId)) return { ok: false, reason: "A made-up test user must not have the owner's GitHub id." };

  return { ok: true, dataDir, token, spareTokens, userTokens, exportKeyHash, ownerId };
}
