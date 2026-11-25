// Small shared pieces from the design spec (section 4): Count, StatusChip, ProgressBar,
// GroupLabel, button styles and external links. Server Components.
import type { ChipState } from "@/lib/status";
import { cn } from "./cn";

/** "3/7" on screen; "3 of 7 done" for screen readers. */
export function Count({ done, total, className }: { done: number; total: number; className?: string }) {
  return (
    <span className={cn("type-num whitespace-nowrap text-muted", className)}>
      <span aria-hidden="true">
        {done}/{total}
      </span>
      <span className="sr-only">
        {done} of {total} done
      </span>
    </span>
  );
}

const CHIP_STYLES: Record<ChipState["variant"], string> = {
  neutral: "bg-sunk text-muted",
  ok: "bg-accent-soft text-accent",
  now: "bg-accent text-accent-ink",
  warn: "bg-warn-soft text-warn",
};

export function StatusChip({ chip }: { chip: ChipState }) {
  return (
    <span className={cn("type-label whitespace-nowrap rounded-full px-2 py-[3px]", CHIP_STYLES[chip.variant])}>{chip.label}</span>
  );
}

/** Decorative: the number beside it says the same. */
export function ProgressBar({ percent, className }: { percent: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("h-1.5 overflow-hidden rounded-full bg-sunk", className)}>
      <div
        className="h-full rounded-full bg-accent motion-safe:transition-[width] motion-safe:duration-300"
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

export function GroupLabel({ children, hidden }: { children: React.ReactNode; hidden?: boolean }) {
  return (
    <p hidden={hidden} className="type-label mt-2 text-muted">
      {children}
    </p>
  );
}

const BUTTON_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 type-body-strong motion-safe:transition-colors motion-safe:duration-150 disabled:cursor-not-allowed disabled:opacity-50";

export const buttonStyles = {
  primary: cn(BUTTON_BASE, "bg-accent text-accent-ink hover:bg-accent-hover disabled:bg-accent"),
  secondary: cn(BUTTON_BASE, "border border-line-strong bg-surface text-ink hover:bg-hover disabled:bg-surface"),
  ghost: cn(BUTTON_BASE, "text-muted hover:bg-hover hover:text-ink disabled:bg-transparent disabled:text-muted"),
};

/** A link that opens in a new tab, with "↗" and a hidden "(opens in a new tab)". */
export function ExternalLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("text-accent underline underline-offset-2 [overflow-wrap:anywhere]", className)}
    >
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
