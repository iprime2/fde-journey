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
      {/* The lockup (in CenteredPage) names the app; the page's heading is the message in the card. */}
      <div className={cn(CARD_STYLES, "grid justify-items-start gap-4 p-4")}>
        <h1 className="type-title">This page doesn&apos;t exist.</h1>
        <Link href="/" className={buttonStyles.primary}>
          Go to Home
        </Link>
      </div>
    </CenteredPage>
  );
}
