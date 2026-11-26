// Who may sign in: the one switch for M4b's capped sign-up (M4-DESIGN 2). Read from SIGNUP_MODE on
// the server at request time. Pure, so tests pass their own environment.
//
// - "owner-only" (default; anything but "capped"): only OWNER_GITHUB_ID's GitHub account can sign
//   in, as before M4b. Every other account is refused before anything is stored.
// - "capped": anyone with a GitHub account can sign in. A new account gets a place while fewer
//   than the user cap (app_setting user_cap) have one, otherwise it joins the waitlist
//   (lib/places.ts). Suspended accounts can't sign in. The owner is never capped.
//
// The owner turns it on after trying everything with a second test account (M4-DESIGN 8).

type Env = Record<string, string | undefined>;

export type SignupMode = "owner-only" | "capped";

export function signupMode(env: Env = process.env): SignupMode {
  return env.SIGNUP_MODE?.trim() === "capped" ? "capped" : "owner-only";
}
