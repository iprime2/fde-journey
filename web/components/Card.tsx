// Card and its head (design spec 4, Card). Server Components.
import type { ChipState } from "@/lib/status";
import { cn } from "./cn";
import { Count, StatusChip } from "./ui";

export const CARD_STYLES = "min-w-0 rounded-lg border border-line bg-surface";

export function CardHeadContent({
  title,
  titleId,
  sub,
  subIsDate,
  chip,
  done,
  total,
  before,
}: {
  title: string;
  titleId?: string;
  sub?: string;
  subIsDate?: boolean;
  chip?: ChipState;
  done?: number;
  total?: number;
  /** Shown before the title block, e.g. the caret of a collapsible card. */
  before?: React.ReactNode;
}) {
  return (
    <>
      {before}
      <div className="min-w-0 flex-[1_1_220px]">
        <h2 id={titleId} className="type-title">
          {title}
        </h2>
        {sub && <p className={cn("text-muted", subIsDate ? "type-num" : "type-small")}>{sub}</p>}
      </div>
      {chip && <StatusChip chip={chip} />}
      {done !== undefined && total !== undefined && <Count done={done} total={total} />}
    </>
  );
}

export const CARD_HEAD_STYLES = "flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5";

export function CardDescription({ children }: { children: React.ReactNode }) {
  return <p className="type-small max-w-[65ch] px-4 pb-3 text-muted">{children}</p>;
}
