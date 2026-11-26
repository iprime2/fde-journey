// Whether the page may offer write controls. M1 had a fixed read-only preview; from M2 this is
// the real session check. Server-only: read it in a Server Component inside <Suspense> and pass
// the result down as a prop (client components cannot import this module).
import "server-only";
import { getIdentity } from "./session";

/**
 * True unless the visitor is signed in with a place (an active user, or the owner). Waitlisted
 * users never see these pages (they go to /waitlist), but nothing they see may offer a save.
 * Memoised per request (via the session).
 */
export async function isReadOnly(): Promise<boolean> {
  return (await getIdentity())?.status !== "active";
}
