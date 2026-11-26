// Cards for the section pages. Server Components.
import { useId } from "react";
import type { CardModel, ModuleCardModel } from "@/lib/views";
import { CARD_STYLES, CardDescription, CardHead } from "./Card";
import { CollapsibleCard } from "./CollapsibleCard";
import { FilterSection } from "./filter/Filtered";
import { ItemList } from "./ItemRow";
import { JournalEditor } from "./JournalEditor";

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

/** Weekly notes on Career (design spec 4, JournalEditor). */
export function JournalCard({ note, sub, readOnly }: { note: string; sub: string; readOnly: boolean }) {
  const titleId = useId();
  return (
    <FilterSection section="journal" className="grid">
      <section className={CARD_STYLES}>
        <CardHead title="Weekly notes" titleId={titleId} sub={sub} />
        <JournalEditor note={note} labelledBy={titleId} readOnly={readOnly} />
      </section>
    </FilterSection>
  );
}
