// The signed-in account, for the sidebar foot (desktop) and the More sheet (phone). Server
// Components: they read the session (lib/session.ts) and build the avatar URL here, on the
// server, so nothing from the browser decides which image loads. Render each inside <Suspense>
// with its skeleton (design spec 4, AccountMenu).
import { signOut } from "@/app/actions/auth";
import { type AccountView, accountView } from "@/lib/account";
import { describeError, rethrowNextControl } from "@/lib/safe-log";
import { getIdentity } from "@/lib/session";
import { AccountMenu } from "./AccountMenu";
import { Avatar } from "./Avatar";
import { SignOutButton } from "./SignOutButton";

/**
 * The signed-in user's account, or null when it can't be read. Signed-out visitors never get here (the
 * page sends them to /login); if the session check itself fails, a plain Sign out still shows.
 * Next's own control errors (a redirect, a prerender that has completed) are not failures: they
 * go back to Next, unlogged, even when wrapped in another error.
 */
async function loadAccount(): Promise<AccountView | null> {
  try {
    const me = await getIdentity();
    return me ? accountView(me) : null;
  } catch (error) {
    rethrowNextControl(error);
    console.error(`Account menu: session check failed (${describeError(error)})`);
    return null;
  }
}

/** Desktop: the account button and its panel. */
export async function SidebarAccount() {
  const account = await loadAccount();
  if (!account) {
    return (
      <form action={signOut}>
        <SignOutButton look="ghost" />
      </form>
    );
  }
  return <AccountMenu account={account} />;
}

/** Phone: the account row under the divider in the More sheet. Only its button is interactive. */
export async function SheetAccount() {
  const account = await loadAccount();
  if (!account) {
    return (
      <form action={signOut} className="flex justify-end py-2 pr-1">
        <SignOutButton look="secondary" />
      </form>
    );
  }
  return (
    <div className="flex min-h-[60px] items-center gap-3 py-2 pr-1 pl-3">
      <Avatar initials={account.initials} src={account.avatar} />
      <div className="min-w-0 flex-1">
        <p className="type-body-strong line-clamp-2 [overflow-wrap:anywhere]">{account.name}</p>
        <p className="type-small text-muted">Signed in with GitHub</p>
      </div>
      <form action={signOut} className="flex-none">
        <SignOutButton look="secondary" />
      </form>
    </div>
  );
}

const BLOCK = "rounded-sm bg-sunk motion-safe:animate-skeleton";

/** Same size as the account button or row, so nothing jumps when it arrives. */
export function AccountSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div aria-busy="true" className={`flex items-center gap-2.5 px-2.5 ${tall ? "min-h-[60px]" : "min-h-[52px]"}`}>
      <span className="sr-only">Loading</span>
      <span className="size-8 flex-none rounded-full bg-sunk motion-safe:animate-skeleton" />
      <span className={`h-3 w-24 ${BLOCK}`} />
    </div>
  );
}
