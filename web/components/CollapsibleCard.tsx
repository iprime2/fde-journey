"use client";

import { OPEN_MODULES_KEY } from "@/lib/open-state";
import { CARD_HEAD_STYLES, CARD_STYLES } from "./Card";
import { cn } from "./cn";
import { useFilter } from "./filter/FilterProvider";
import { useRememberedDetails } from "./useRememberedDetails";

/** A Scaler module: a card that opens and closes (design spec 4, CollapsibleCard). */
export function CollapsibleCard({
  moduleNumber,
  currentModule,
  head,
  children,
}: {
  moduleNumber: number;
  currentModule: number;
  /** The card head content: title block, chip and count. */
  head: React.ReactNode;
  children: React.ReactNode;
}) {
  const f = useFilter();
  const section = `mod-${moduleNumber}`;
  const { open, onToggle } = useRememberedDetails({
    storageKey: OPEN_MODULES_KEY,
    member: String(moduleNumber),
    defaults: [String(currentModule)],
    matchInside: f.visibility.sections.has(section),
    asNumbers: true,
  });
  return (
    <details
      open={open}
      onToggle={onToggle}
      hidden={f.provided && !f.visibility.sections.has(section)}
      className={cn(CARD_STYLES, "group/mod")}
      data-module={moduleNumber}
    >
      <summary className={cn(CARD_HEAD_STYLES, "min-h-14 rounded-lg")}>
        <span
          aria-hidden="true"
          className="self-start font-mono text-[18px] leading-[1.3] text-muted motion-safe:transition-transform motion-safe:duration-200 group-open/mod:rotate-90"
        >
          ›
        </span>
        {head}
      </summary>
      {children}
    </details>
  );
}
