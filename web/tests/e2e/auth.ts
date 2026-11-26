// Test sign-in for the end-to-end tests. playwright.config.ts creates a random secret and session
// token for each run; scripts/e2e-seed.mjs stores the token as the made-up owner's session in a
// fresh local test database; the fixtures send it as a cookie signed with the secret, exactly as
// Better Auth would after a real GitHub sign-in. No real credential is involved anywhere.
import { createHmac, randomBytes } from "node:crypto";

export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
/** Made-up GitHub id for the test owner. */
export const E2E_OWNER_GITHUB_ID = "900000000001";
export const SESSION_COOKIE = "better-auth.session_token";

/**
 * The run's secret and session token. Created once in the runner process and kept in its
 * environment, which the test workers and the web server inherit.
 */
export function e2eRunSecrets(): { secret: string; token: string } {
  const secret = process.env.E2E_AUTH_SECRET || randomBytes(32).toString("base64url");
  const token = process.env.E2E_SESSION_TOKEN || randomBytes(32).toString("base64url");
  process.env.E2E_AUTH_SECRET = secret;
  process.env.E2E_SESSION_TOKEN = token;
  return { secret, token };
}

/** Better Auth's signed cookie value: token, ".", base64 HMAC-SHA256 of the token. */
export function signedSessionCookie() {
  const { secret, token } = e2eRunSecrets();
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  return encodeURIComponent(`${token}.${signature}`);
}
