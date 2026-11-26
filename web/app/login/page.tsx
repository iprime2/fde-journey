import type { Metadata } from "next";
import { Suspense } from "react";
import { signInWithGitHub } from "@/app/actions/auth";
import { Banner } from "@/components/Banner";
import { CenteredPage } from "@/components/CenteredPage";
import { SignInButton } from "@/components/SignInButton";
import { type LoginNotice, parseLoginParams } from "@/lib/login";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <CenteredPage>
      <header className="grid gap-1.5">
        <p className="type-label text-accent">AI Engineering &amp; FDE</p>
        <h1 className="type-display">FDE Journey</h1>
        <p className="type-body text-muted">
          A private tracker for an AI engineering and Forward Deployed Engineer (FDE) learning journey. Only the
          owner&apos;s GitHub account can sign in.
        </p>
      </header>
      {/* The address says where to go afterwards and which message to show, so it streams in. */}
      <Suspense fallback={<SignInButton disabled />}>
        <SignInForm searchParams={searchParams} />
      </Suspense>
    </CenteredPage>
  );
}

async function SignInForm({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next, notice } = parseLoginParams(await searchParams);
  return (
    <>
      <form action={signInWithGitHub}>
        <input type="hidden" name="next" value={next} />
        <SignInButton />
      </form>
      <LoginMessage notice={notice} />
    </>
  );
}

/** Design spec 8: the messages under the sign-in button. */
function LoginMessage({ notice }: { notice: LoginNotice }) {
  switch (notice) {
    case "not-owner":
      return <Banner tone="error">This GitHub account can&apos;t sign in. The app is private to its owner.</Banner>;
    case "failed":
      return <Banner tone="error">Sign-in didn&apos;t finish. Try again.</Banner>;
    case "signed-out":
      return <Banner tone="info">You&apos;re signed out.</Banner>;
    default:
      return null;
  }
}
