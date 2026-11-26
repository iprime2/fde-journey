import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, useId } from "react";
import { signInWithGitHub } from "@/app/actions/auth";
import { Banner } from "@/components/Banner";
import { BrandLockup } from "@/components/Brand";
import { CheckIcon, LockIcon } from "@/components/icons";
import { JourneyPreview } from "@/components/JourneyPreview";
import { SignInButton } from "@/components/SignInButton";
import { GITHUB_NEW_ISSUE_URL } from "@/lib/links";
import { ACCESS_COPY, type AccessMode, loginMessage, parseLoginParams } from "@/lib/login";
import { describeError, rethrowNextControl } from "@/lib/safe-log";
import { getIdentity } from "@/lib/session";
import { signupMode } from "@/lib/signup-mode";

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
          {/* 28/18 here, 32/20 on the brand panel (the panel sets --wordmark-size). */}
          <BrandLockup markClassName="lg:size-8 lg:text-brand-accent" />
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
          {/* The address, the sign-in cookie and the sign-up mode (SIGNUP_MODE, read at request
              time) decide what shows, so this part streams in. */}
          <Suspense
            fallback={
              <>
                <AccessLine id={accessId} />
                <SignInButton disabled describedBy={accessId} />
              </>
            }
          >
            <SignInForm searchParams={searchParams} accessId={accessId} />
          </Suspense>
          <p className="type-small border-t border-line pt-3.5 text-muted">
            GitHub shares your profile and email address with FDE Journey. It can&apos;t post or change anything on
            GitHub.
          </p>
          <p className="type-small -mt-2">
            <Link href="/privacy" className="text-accent underline underline-offset-2">
              Privacy: what&apos;s stored and who sees it
            </Link>
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
  // Already signed in: go on to `next` (already checked by safeNextPath) or Home; a waitlisted
  // user to /waitlist. Whatever the message: after sign-out or a failed sign-in there is no
  // session, and a user who is signed in has nothing to do here.
  const status = await signedInStatus();
  if (status === "active") redirect(next);
  if (status === "waitlisted") redirect("/waitlist");
  const mode: AccessMode = signupMode();
  const message = loginMessage(notice, mode);
  return (
    <>
      <AccessLine id={accessId} mode={mode} />
      {/* Above the button, so the problem is read before the action (design spec 5). Nothing at
          all when there is no message, or the card's gap would double. */}
      {message && (
        <Banner
          tone={message.tone}
          action={notice === "suspended" ? { label: "Open an issue", href: GITHUB_NEW_ISSUE_URL, external: true } : undefined}
        >
          {message.text}
        </Banner>
      )}
      <form action={signInWithGitHub}>
        <input type="hidden" name="next" value={next} />
        <SignInButton describedBy={accessId} />
      </form>
    </>
  );
}

/**
 * Who may sign in (design spec 8, ACCESS_COPY), in the sunk box above the button. The button's
 * aria-describedby points at it. Without a mode (while the page streams in) it holds a placeholder.
 */
function AccessLine({ id, mode }: { id: string; mode?: AccessMode }) {
  return (
    <p id={id} className="type-small flex items-start gap-2 rounded-md bg-sunk px-3 py-2.5 text-muted">
      <LockIcon size={16} className="mt-px flex-none" />
      {mode ? (
        <span>{ACCESS_COPY[mode].access}</span>
      ) : (
        <span aria-busy="true" className="grid flex-1 gap-1.5 py-0.5">
          <span className="sr-only">Loading</span>
          <span className="h-3 w-full rounded-sm bg-line motion-safe:animate-skeleton" />
          <span className="h-3 w-2/3 rounded-sm bg-line motion-safe:animate-skeleton" />
        </span>
      )}
    </p>
  );
}

/**
 * The signed-in visitor's status, or null. If the check itself fails (database unreachable), the
 * sign-in page still shows, as it did before this check existed.
 */
async function signedInStatus(): Promise<"active" | "waitlisted" | null> {
  try {
    return (await getIdentity())?.status ?? null;
  } catch (error) {
    rethrowNextControl(error);
    console.error(`Sign-in page: session check failed (${describeError(error)})`);
    return null;
  }
}
