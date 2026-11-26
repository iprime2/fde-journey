// Not found inside the app frame (design spec 5, Not found, v0.6): a locked Scaler section, or an
// admin page without its permission. The sidebar or bottom bar is already on screen, so there is no
// second lockup and no CenteredPage: the same card, at the top-left of the content column, where a
// PageHeader would start. Unknown addresses use app/not-found.tsx.
import type { Metadata } from "next";
import Link from "next/link";
import { CARD_STYLES } from "@/components/Card";
import { cn } from "@/components/cn";
import { DocumentTitle } from "@/components/DocumentTitle";
import { buttonStyles } from "@/components/ui";

export const metadata: Metadata = { title: "Page not found" };

export default function InAppNotFound() {
  return (
    <div className={cn(CARD_STYLES, "grid w-full max-w-[400px] justify-items-start gap-4 p-4")}>
      <DocumentTitle title="Page not found · FDE Journey" />
      <h1 tabIndex={-1} className="type-title">
        This page doesn&apos;t exist.
      </h1>
      <Link href="/" className={buttonStyles.primary}>
        Go to Home
      </Link>
    </div>
  );
}
