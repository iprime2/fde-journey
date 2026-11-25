import type { Metadata } from "next";
import { Banner } from "@/components/Banner";
import { CenteredPage } from "@/components/CenteredPage";
import { GitHubMark } from "@/components/icons";
import { buttonStyles } from "@/components/ui";
import { cn } from "@/components/cn";

export const metadata: Metadata = { title: "Sign in" };

// M1: sign-in arrives with saving (M2), so the button is shown but disabled.
export default function LoginPage() {
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
      <button type="button" disabled className={cn(buttonStyles.primary, "w-full")}>
        <GitHubMark size={20} />
        Sign in with GitHub
      </button>
      <Banner tone="info">Sign-in isn&apos;t available yet. It arrives together with saving.</Banner>
    </CenteredPage>
  );
}
