import type { Metadata } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { Suspense, useId } from "react";
import { signInWithGitHub } from "@/app/actions/auth";
import { Banner } from "@/components/Banner";
import { LogoMark } from "@/components/Brand";
import { CheckIcon, LockIcon } from "@/components/icons";
import { JourneyPreview } from "@/components/JourneyPreview";
import { SignInButton } from "@/components/SignInButton";
import { ACCESS_COPY, ACCESS_MODE, loginMessage, parseLoginParams } from "@/lib/login";
import { getOwnerSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

const POINTS = [
  "Roadmap, classes and certifications in one place",
  "A note and a link on every step",
  "Made for your phone and your laptop",
];

/**
 * Design spec 5, /login. One DOM for every size: below 1024 px a compact header above the card;
 * from 1024 px a dark brand panel (the same in light and dark mode) beside the card.
 */
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  const accessId = useId();
  return (
    <main
      id="main"
      className="grid min-h-dvh content-start gap-6 pt-[max(32px,env(safe-area-inset-top))] pr-[max(16px,env(safe-area-inset-right))] pb-10 pl-[max(16px,env(safe-area-inset-left))] short:pt-6 md:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:content-stretch lg:gap-0 lg:p-0"
    >
      <div className="brand-panel mx-auto w-full max-w-[400px] lg:relative lg:m-0 lg:flex lg:min-h-dvh lg:max-w-none lg:flex-col lg:overflow-hidden lg:bg-brand-panel lg:p-[clamp(40px,4.5vw,64px)] lg:text-brand-ink lg:[--wordmark-size:20px]">
        <div className="grid gap-2 lg:relative lg:mx-auto lg:flex lg:w-full lg:max-w-[34rem] lg:flex-1 lg:flex-col lg:gap-8">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-7 text-accent lg:size-8 lg:text-brand-accent" />
            <p className="type-wordmark">FDE Journey</p>
          </div>
          <div className="lg:mt-auto lg:grid lg:gap-5">
            <p className="type-body max-w-[34em] text-muted short:hidden lg:type-hero lg:max-w-none lg:text-brand-ink">
              From AI engineer to Forward Deployed Engineer, one milestone at a time.
            </p>
            <ul className="hidden gap-2.5 text-brand-muted lg:grid">
              {POINTS.map((point) => (
                <li key={point} className="flex items-center gap-2.5">
                  <CheckIcon size={18} className="flex-none text-brand-accent" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <JourneyPreview className="hidden lg:mb-auto lg:block" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[400px] lg:sticky lg:top-0 lg:m-0 lg:grid lg:h-dvh lg:max-w-none lg:place-items-center lg:px-8 lg:py-12">
        <div className="grid w-full max-w-[400px] gap-4 rounded-xl border border-line bg-surface p-6 shadow-raised lg:p-8">
          <h1 className="type-title-lg">Sign in</h1>
          <p className="type-body -mt-2.5 text-muted">Pick up where you left off.</p>
          <p id={accessId} className="type-small flex items-start gap-2 rounded-md bg-sunk px-3 py-2.5 text-muted">
            <LockIcon size={16} className="mt-px flex-none" />
            <span>{ACCESS_COPY[ACCESS_MODE].access}</span>
          </p>
          {/* The address and the sign-in cookie decide what shows, so this part streams in. */}
          <Suspense fallback={<SignInButton disabled describedBy={accessId} />}>
            <SignInForm searchParams={searchParams} accessId={accessId} />
          </Suspense>
          <p className="type-small border-t border-line pt-3.5 text-muted">
            GitHub shares your profile and email address with FDE Journey. It can&apos;t post or change anything on
            GitHub.
          </p>
        </div>
      </div>
    </main>
  );
}

async function SignInForm({
  searchParams,
  accessId,
}: Pick<PageProps<"/login">, "searchParams"> & { accessId: string }) {
  const { next, notice } = parseLoginParams(await searchParams);
  // Already signed in as the owner: go on to `next` (already checked by safeNextPath) or Home.
  // Whatever the message: after sign-out or a failed sign-in there is no owner session, and an
  // owner who is signed in has nothing to do here.
  if (await signedInOwner()) redirect(next);
  const message = loginMessage(notice);
  return (
    <>
      {/* Above the button, so the problem is read before the action (design spec 5). Nothing at
          all when there is no message, or the card's gap would double. */}
      {message && <Banner tone={message.tone}>{message.text}</Banner>}
      <form action={signInWithGitHub}>
        <input type="hidden" name="next" value={next} />
        <SignInButton describedBy={accessId} />
      </form>
    </>
  );
}

/**
 * True when the visitor is the signed-in owner. If the check itself fails (database unreachable),
 * the sign-in page still shows, as it did before this check existed.
 */
async function signedInOwner(): Promise<boolean> {
  try {
    return (await getOwnerSession()) !== null;
  } catch (error) {
    unstable_rethrow(error);
    console.error(`Sign-in page: session check failed (${error instanceof Error ? error.name : "unknown"})`);
    return false;
  }
}
