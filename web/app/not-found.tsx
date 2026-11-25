import type { Metadata } from "next";
import Link from "next/link";
import { CenteredPage } from "@/components/CenteredPage";
import { cn } from "@/components/cn";
import { CARD_STYLES } from "@/components/Card";
import { buttonStyles } from "@/components/ui";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <CenteredPage>
      <div className={cn(CARD_STYLES, "grid justify-items-start gap-4 p-4")}>
        <h1 className="type-title">This page doesn&apos;t exist.</h1>
        <Link href="/" className={buttonStyles.primary}>
          Go to Home
        </Link>
      </div>
    </CenteredPage>
  );
}
