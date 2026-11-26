"use client";

import Link from "next/link";
import { CARD_STYLES } from "./Card";
import { cn } from "./cn";
import { buttonStyles } from "./ui";

/** "This page didn't load." with Try again and Go to Home (design spec 6, Page error). */
export function ErrorCard({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className={cn(CARD_STYLES, "grid justify-items-start gap-4 p-4")}>
      <h1 tabIndex={-1} className="type-title">
        This page didn&apos;t load.
      </h1>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonStyles.primary} onClick={() => retry()}>
          Try again
        </button>
        <Link href="/" className={buttonStyles.secondary}>
          Go to Home
        </Link>
      </div>
    </div>
  );
}
