// /waitlist (design spec 5): the only page a waitlisted user can open, besides /privacy and
// sign-out. MINIMAL back-end version: the place in line and Sign out. The front end builds the
// designed page (PlaceInLine, the explanation, the account row, "Leave the waitlist" with its
// Dialog, calling leaveWaitlist() from app/actions/account.ts).
//
// Active users go to Home; signed-out and suspended visitors to /login (getMyWaitlistPlace).
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { CARD_STYLES } from "@/components/Card";
import { CenteredPage } from "@/components/CenteredPage";
import { cn } from "@/components/cn";
import { SignOutButton } from "@/components/account/SignOutButton";
import { formatDate, istDate } from "@/lib/dates";
import { getMyWaitlistPlace } from "@/lib/settings";

export const metadata: Metadata = { title: "Waitlist" };

export default function WaitlistPage() {
  return (
    <CenteredPage>
      <div className={cn(CARD_STYLES, "grid justify-items-start gap-4 p-6")}>
        <h1 className="type-title-lg">You&apos;re on the waitlist</h1>
        <Suspense fallback={<p className="type-small text-muted">Loading your place…</p>}>
          <Place />
        </Suspense>
        <form action={signOut}>
          <SignOutButton look="secondary" />
        </form>
      </div>
    </CenteredPage>
  );
}

async function Place() {
  const view = await getMyWaitlistPlace();
  if (!view) redirect("/");
  const ahead = view.place - 1;
  return (
    <div className="grid gap-1">
      <p className="type-body">
        Your place in line: <span className="num">{view.place}</span>
      </p>
      <p className="type-small text-muted">
        {ahead === 0 ? "You're next." : `${ahead} ${ahead === 1 ? "person is" : "people are"} ahead of you.`}
      </p>
      <p className="type-small text-muted">Joined the waitlist on {formatDate(istDate(Date.parse(view.joinedAt)))}.</p>
    </div>
  );
}
