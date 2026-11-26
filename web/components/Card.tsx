// Card and its head (design spec 4, Card). No client code, so both Server and Client Components
// can render it.
import type { ChipState } from "@/lib/status";
import { cn } from "./cn";
import { Count, StatusChip } from "./ui";

export const CARD_STYLES = "min-w-0 rounded-lg border border-line bg-surface";

/**
 * Wrapping row: [h2 and sub line] [chip and count]. The chip and count stay together, so at
 * 390 px they move to the next line as one group.
 */
export function CardHead({
  title,
  titleId,
  sub,
  subIsDate,
  chip,
  done,
  total,
  countWord,
  className,
}: {
  /** The heading's content: text, or a disclosure button for a collapsible card. */
  title: React.ReactNode;
  titleId?: string;
  sub?: string;
  subIsDate?: boolean;
  chip?: ChipState;
  done?: number;
  total?: number;
  /** The Count's hidden word: "3 of 7 done" by default, "1 of 7 passed" with "passed". */
  countWord?: string;
  className?: string;
}) {
  const hasCount = done !== undefined && total !== undefined;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5", className)}>
      <div className="min-w-0 flex-[1_1_220px]">
        <h2 id={titleId} className="type-title [overflow-wrap:anywhere]">
          {title}
        </h2>
        {sub && <p className={cn("max-w-[34em] text-muted", subIsDate ? "type-num" : "type-small")}>{sub}</p>}
      </div>
      {(chip || hasCount) && (
        <div className="flex items-center gap-3 self-start whitespace-nowrap">
          {chip && <StatusChip chip={chip} />}
          {hasCount && <Count done={done} total={total} word={countWord} />}
        </div>
      )}
    </div>
  );
}

export function CardDescription({ children }: { children: React.ReactNode }) {
  return <p className="type-small max-w-[34em] px-4 pb-3 text-muted">{children}</p>;
}

/** The "›" before a collapsible title; turns to point down when open. */
export function Caret({ open, className }: { open: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block font-mono motion-safe:transition-transform motion-safe:duration-200", open && "rotate-90", className)}
    >
      ›
    </span>
  );
}
