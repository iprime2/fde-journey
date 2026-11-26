// Cards for the section pages. Server Components.
import { useId } from "react";
import { JOURNAL_ID } from "@/lib/ids";
import type { CardModel, ModuleCardModel } from "@/lib/views";
import { CARD_STYLES, CardDescription, CardHead } from "./Card";
import { cn } from "./cn";
import { CollapsibleCard } from "./CollapsibleCard";
import { FilterSection } from "./filter/Filtered";
import { ItemList } from "./ItemRow";

export function SectionCard({ card, readOnly }: { card: CardModel; readOnly: boolean }) {
  return (
    <FilterSection section={card.key} className="grid">
      <section className={CARD_STYLES}>
        <CardHead
          title={card.title}
          sub={card.sub}
          subIsDate={card.subIsDate}
          chip={card.chip}
          done={card.done}
          total={card.rows.length}
        />
        {card.desc && <CardDescription>{card.desc}</CardDescription>}
        <ItemList rows={card.rows} readOnly={readOnly} />
      </section>
    </FilterSection>
  );
}

export function ModuleCard({ card, currentModule, readOnly }: { card: ModuleCardModel; currentModule: number; readOnly: boolean }) {
  return (
    <CollapsibleCard
      moduleNumber={card.n}
      currentModule={currentModule}
      title={card.title}
      sub={card.sub}
      chip={card.chip}
      done={card.done}
      total={card.rows.length}
    >
      <ItemList rows={card.rows} readOnly={readOnly} />
    </CollapsibleCard>
  );
}

/** Weekly notes on Career (design spec 4, JournalEditor). Disabled while nothing can be saved. */
export function JournalCard({ note, sub, readOnly }: { note: string; sub: string; readOnly: boolean }) {
  const titleId = useId();
  return (
    <FilterSection section="journal" className="grid">
      <section className={CARD_STYLES}>
        <CardHead title="Weekly notes" titleId={titleId} sub={sub} />
        <div id={`item-${JOURNAL_ID}`} className="grid gap-1.5 border-t border-line px-4 pt-3 pb-4">
          <textarea
            aria-labelledby={titleId}
            defaultValue={note}
            disabled={readOnly}
            placeholder="What did you complete this week? What is blocking you?"
            className={cn(
              "type-input min-h-40 w-full resize-y rounded-md border border-line-strong bg-surface px-3 py-2.5 text-ink [overflow-wrap:anywhere]",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />
          <p className="type-num min-h-[1.4em] text-muted" aria-live="polite" />
        </div>
      </section>
    </FilterSection>
  );
}
