// /waitlist (design spec 5): the only page a waitlisted user can open, besides /privacy and
// sign-out. The CenteredPage frame at every width: lockup, then one card with the place in line,
// the explanation, the account row and "Leave the waitlist".
//
// Active users go to Home; signed-out and suspended visitors to /login (getMyWaitlistPlace).
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, cache } from "react";
import { signOut } from "@/app/actions/auth";
import { Avatar } from "@/components/account/Avatar";
import { SignOutButton } from "@/components/account/SignOutButton";
import { CenteredPage } from "@/components/CenteredPage";
import { PlaceInLine, PlaceInLineSkeleton } from "@/components/PlaceInLine";
import { LeaveWaitlist, OfflineNotice } from "@/components/waitlist/LeaveWaitlist";
import { accountView } from "@/lib/account";
import { formatIstDate } from "@/lib/admin-format";
import { getMyWaitlistPlace } from "@/lib/settings";

export const metadata: Metadata = { title: "Waitlist" };

/** One read per request, shared by the two parts that stream in. Null for an active user. */
const waitlistPlace = cache(getMyWaitlistPlace);

const DIVIDER = "border-t border-line pt-4";

export default function WaitlistPage() {
  return (
    <CenteredPage>
      <OfflineNotice />
      <div className="grid gap-4 rounded-xl border border-line bg-surface p-6 shadow-raised lg:p-8">
        <h1 className="type-title-lg">You&apos;re on the waitlist</h1>
        <Suspense fallback={<PlaceInLineSkeleton />}>
          <Place />
        </Suspense>
        <p className="type-body">
          FDE Journey has a limited number of places, and they&apos;re all taken right now. You&apos;ll get in when a
          place opens or the owner adds more places, in the order people joined.
        </p>
        <p className="type-body">
          We don&apos;t send email, so check back here. Sign in any time to see your place; once you&apos;re in,
          you&apos;ll go straight to your tracker.
        </p>
        <Suspense fallback={<AccountFallback />}>
          <Account />
        </Suspense>
        <div className={DIVIDER}>
          <LeaveWaitlist />
        </div>
      </div>
      <p className="type-small text-center">
        <Link href="/privacy" className="text-accent underline underline-offset-2">
          Privacy: what&apos;s stored and who sees it
        </Link>
      </p>
    </CenteredPage>
  );
}

async function Place() {
  const view = await waitlistPlace();
  if (!view) redirect("/");
  return <PlaceInLine place={view.place} />;
}

/** The joined date, then the account row with Sign out (as in the More sheet). */
async function Account() {
  const view = await waitlistPlace();
  if (!view) redirect("/");
  const account = accountView(view);
  return (
    <>
      <p className="type-small text-muted">Joined the waitlist on {formatIstDate(view.joinedAt)}.</p>
      <div className={`${DIVIDER} flex flex-wrap items-center gap-3`}>
        <Avatar initials={account.initials} src={account.avatar} />
        <div className="min-w-0 flex-[1_1_140px]">
          <p className="type-body-strong line-clamp-2 [overflow-wrap:anywhere]">{account.name}</p>
          <p className="type-small text-muted">Signed in with GitHub</p>
        </div>
        <form action={signOut} className="flex-none">
          <SignOutButton look="secondary" />
        </form>
      </div>
    </>
  );
}

/** Sign out works even before the details arrive. */
function AccountFallback() {
  return (
    <div className={`${DIVIDER} flex items-center justify-end`}>
      <form action={signOut}>
        <SignOutButton look="secondary" />
      </form>
    </div>
  );
}
