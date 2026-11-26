// The FDE Journey logo (design spec 9). Server Component.
import { cn } from "./cn";

/**
 * The mark: a path drawn as a lowercase "j", ending in a spark. Paths from
 * public/brand/logo-mark-mono.svg, in `currentColor`, so the colour tokens and dark mode drive it.
 * Always decorative: the wordmark beside it is the text.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn("flex-none", className)}
    >
      <path d="M8 21.5a7 7 0 0 0 14 0V15" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <circle cx="8" cy="19.5" r="4" />
      <path d="M22 .5l1.6 3.4 3.4 1.6-3.4 1.6L22 10.5l-1.6-3.4L17 5.5l3.4-1.6z" />
    </svg>
  );
}

/**
 * The lockup: mark plus "FDE Journey" (design spec 4, BrandLockup). The wordmark is a <p>, never
 * the page's h1, and the lockup is not a link. Sizes: `sm` 24/18 (sidebar), `md` 28/18 (sign-in
 * page below 1024 px, not found). The brand panel enlarges it with its own classes.
 */
export function BrandLockup({
  size = "md",
  className,
  markClassName,
}: {
  size?: "sm" | "md";
  className?: string;
  markClassName?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={cn(size === "sm" ? "size-6" : "size-7", "text-accent", markClassName)} />
      <p className="type-wordmark">FDE Journey</p>
    </div>
  );
}
