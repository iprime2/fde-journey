import Link from "next/link";
import type { BannerAction, BannerTone } from "@/lib/banners";
import { cn } from "./cn";

const TONE_STYLES: Record<BannerTone, string> = {
  info: "bg-sunk text-ink",
  warning: "bg-warn-soft text-warn",
  error: "bg-danger-soft text-danger",
};

/** Full-width message strip. Errors use role="alert"; the others role="status". */
export function Banner({
  tone,
  children,
  action,
}: {
  tone: BannerTone;
  children: React.ReactNode;
  /** Optional action after the message, as an underlined text link. */
  action?: BannerAction;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("type-small rounded-md px-3.5 py-2.5 [overflow-wrap:anywhere]", TONE_STYLES[tone])}
    >
      {children}
      {action && (
        <>
          {" "}
          {action.external ? (
            <a href={action.href} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
              {action.label}
              <span aria-hidden="true"> ↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <Link href={action.href} className="font-semibold underline underline-offset-2">
              {action.label}
            </Link>
          )}
          {action.after}
        </>
      )}
    </div>
  );
}
