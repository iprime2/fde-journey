// Small shared pieces from the design spec (section 4): Count, StatusChip, ProgressBar,
// GroupLabel, button styles and external links. Server Components.
import type { ChipState } from "@/lib/status";
import { cn } from "./cn";
import { isHttpsUrl } from "@/lib/notes";

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
  danger: "bg-danger-soft text-danger",
};

/** `wrap`: the label may wrap onto a second line when the row has no room (row chips). */
export function StatusChip({ chip, wrap = false }: { chip: ChipState; wrap?: boolean }) {
  return (
    <span
      className={cn(
        "type-label rounded-full px-2 py-[3px]",
        wrap ? "max-w-full text-balance [overflow-wrap:anywhere]" : "whitespace-nowrap",
        CHIP_STYLES[chip.variant],
      )}
    >
      {chip.label}
    </span>
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

// Disabled buttons fade to 0.5, except while busy (`aria-busy`): a loading button stays at full
// opacity with a progress cursor, so it looks busy rather than broken (design spec 4, Button).
const BUTTON_CORE =
  "inline-flex items-center justify-center rounded-md px-4 type-body-strong motion-safe:transition-[color,background-color,border-color] motion-safe:duration-150 disabled:not-aria-busy:cursor-not-allowed disabled:not-aria-busy:opacity-50 aria-busy:cursor-progress";
const BUTTON_BASE = cn(BUTTON_CORE, "min-h-11 gap-2");
/** Size `lg`, the sign-in button only: 48 px tall, 10 px gap for a 20 px icon. */
const BUTTON_LG = cn(BUTTON_CORE, "min-h-12 gap-2.5");

/** Size `sm` (v0.5, row actions on admin pages): 36 px to see, 44 px to hit, 13 px text at 500. */
const BUTTON_SM = cn(
  BUTTON_CORE,
  "relative min-h-9 gap-1.5 px-3 type-small font-medium before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
);

const PRIMARY = "bg-accent text-accent-ink hover:bg-accent-hover disabled:bg-accent";
const SECONDARY = "border border-line-strong bg-surface text-ink hover:bg-hover disabled:bg-surface";
/** v0.5: only as the confirm button of a destructive Dialog. */
const DANGER = "bg-danger text-danger-ink hover:bg-danger-hover disabled:bg-danger";
/** v0.5: opens a destructive Dialog ("Delete my account", "Suspend", "Remove"). */
const DANGER_SECONDARY = "border border-danger bg-surface text-danger hover:bg-danger-soft disabled:bg-surface";

export const buttonStyles = {
  primary: cn(BUTTON_BASE, PRIMARY),
  primaryLg: cn(BUTTON_LG, PRIMARY),
  secondary: cn(BUTTON_BASE, SECONDARY),
  ghost: cn(BUTTON_BASE, "text-muted hover:bg-hover hover:text-ink disabled:bg-transparent disabled:text-muted"),
  danger: cn(BUTTON_BASE, DANGER),
  dangerSecondary: cn(BUTTON_BASE, DANGER_SECONDARY),
  primarySm: cn(BUTTON_SM, PRIMARY),
  secondarySm: cn(BUTTON_SM, SECONDARY),
  dangerSecondarySm: cn(BUTTON_SM, DANGER_SECONDARY),
  ghostSm: cn(BUTTON_SM, "text-muted hover:bg-hover hover:text-ink disabled:bg-transparent disabled:text-muted"),
};

/**
 * An 18 px ring that turns while a button is busy, in place of the button's icon. Shown only with
 * motion allowed; with reduced motion the icon stays and the label alone says it is busy.
 */
export function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="hidden size-[18px] flex-none rounded-full border-2 border-current border-r-transparent motion-safe:block motion-safe:animate-spinner"
    />
  );
}

/** A link that opens in a new tab, with "↗" and a hidden "(opens in a new tab)". */
/** Opens https links in a new tab. Anything else (javascript:, http:, relative) renders as plain text. */
export function ExternalLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  if (!isHttpsUrl(href)) return <span className={cn("[overflow-wrap:anywhere]", className)}>{children}</span>;
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
