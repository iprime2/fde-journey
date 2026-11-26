import type { Metadata } from "next";
import Link from "next/link";
import { CARD_STYLES } from "@/components/Card";
import { CenteredPage } from "@/components/CenteredPage";
import { cn } from "@/components/cn";
import { buttonStyles } from "@/components/ui";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <CenteredPage>
      {/* The app's name, as on /login; the page's heading is the message in the card. */}
      <div className="grid gap-1.5">
        <p className="type-label text-accent">AI Engineering &amp; FDE</p>
        <p className="type-display">FDE Journey</p>
      </div>
      <div className={cn(CARD_STYLES, "grid justify-items-start gap-4 p-4")}>
        <h1 className="type-title">This page doesn&apos;t exist.</h1>
        <Link href="/" className={buttonStyles.primary}>
          Go to Home
        </Link>
      </div>
    </CenteredPage>
  );
}
