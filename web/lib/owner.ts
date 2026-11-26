// The owner rule: only the GitHub account whose numeric id equals OWNER_GITHUB_ID may sign in.
// Logins can be renamed; numeric ids never change. Pure functions, tested directly.
import { NOT_OWNER_ERROR } from "./login";

type Env = Record<string, string | undefined>;

/** OWNER_GITHUB_ID if it is a plain number, otherwise null (then nobody can sign in). */
export function ownerGithubId(env: Env): string | null {
  const id = env.OWNER_GITHUB_ID?.trim();
  return id && /^[1-9]\d{0,19}$/.test(id) ? id : null;
}

/** True when a GitHub id (number or string, as the API or the database gives it) is the owner's. */
export function isOwnerGithubId(id: unknown, ownerId: string | null): boolean {
  if (!ownerId) return false;
  if (typeof id === "number") return Number.isSafeInteger(id) && String(id) === ownerId;
  return typeof id === "string" && id === ownerId;
}

/** The subset of Better Auth's `validateUserInfo` input that the owner rule reads. */
export interface IdentityCheck {
  source: {
    method: string;
    action?: string;
    oauth?: { providerId: string; profile?: Record<string, unknown> | undefined } | undefined;
  };
}

export const NOT_OWNER = { error: NOT_OWNER_ERROR, errorDescription: "This GitHub account can't sign in." } as const;

/**
 * Better Auth's `user.validateUserInfo` gate. It runs before a user is created, before an account
 * is linked and on every GitHub sign-in, with GitHub's fresh profile. Anything but the owner's
 * GitHub account is rejected before a user, account or session row is written.
 */
export function ownerGate(data: IdentityCheck, ownerId: string | null): typeof NOT_OWNER | undefined {
  const { source } = data;
  if (source.method !== "oauth" || source.oauth?.providerId !== "github") return NOT_OWNER;
  return isOwnerGithubId(source.oauth.profile?.id, ownerId) ? undefined : NOT_OWNER;
}
