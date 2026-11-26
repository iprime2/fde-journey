"use client";

// A Scaler module: a card that opens and closes (design spec 4, CollapsibleCard). The h2 holds a
// disclosure button; its ::after covers the whole head, so the full head is the tap target, and
// the focus ring is drawn on the head (.card-head in globals.css).
import { useId } from "react";
import { OPEN_MODULES_KEY } from "@/lib/open-state";
import type { ChipState } from "@/lib/status";
import { CARD_STYLES, CardHead, Caret } from "./Card";
import { useFilter } from "./filter/FilterProvider";
import { useRememberedOpen } from "./useRememberedOpen";

export function CollapsibleCard({
  moduleNumber,
  currentModule,
  title,
  sub,
  chip,
  done,
  total,
  children,
}: {
  moduleNumber: number;
  currentModule: number;
  title: string;
  sub?: string;
  chip?: ChipState;
  done: number;
  total: number;
  children: React.ReactNode;
}) {
  const f = useFilter();
  const section = `mod-${moduleNumber}`;
  const titleId = useId();
  const bodyId = useId();
  const { open, toggle } = useRememberedOpen({
    storageKey: OPEN_MODULES_KEY,
    member: String(moduleNumber),
    defaults: [String(currentModule)],
    matchInside: f.visibility.sections.has(section),
    asNumbers: true,
  });
  return (
    <section
      aria-labelledby={titleId}
      hidden={f.provided && !f.visibility.sections.has(section)}
      className={CARD_STYLES}
      data-module={moduleNumber}
    >
      <CardHead
        className="card-head min-h-14 rounded-lg"
        titleId={titleId}
        title={
          <button type="button" aria-expanded={open} aria-controls={bodyId} onClick={toggle} className="flex gap-2 text-left">
            <Caret open={open} className="text-muted" />
            <span>{title}</span>
          </button>
        }
        sub={sub}
        chip={chip}
        done={done}
        total={total}
      />
      <div id={bodyId} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
