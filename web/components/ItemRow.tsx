// Every task, class, resource, paper, book and milestone (design spec 4, ItemRow).
// Server Component. The row element, the tick box and the note controls are small client parts;
// the title's done style follows the tick box in CSS (.item-row in globals.css), so an optimistic
// tick restyles the title at once.
import type { RowModel } from "@/lib/views";
import { cn } from "./cn";
import { NoteArea } from "./notes/NoteArea";
import { ResourceList } from "./ResourceList";
import { RowShell } from "./row/RowShell";
import { TickBox, TickError } from "./row/TickBox";
import { Count, ExternalLink } from "./ui";

export function ItemRow({
  row,
  readOnly,
  inList = false,
}: {
  row: RowModel;
  readOnly: boolean;
  /** Inside a resource list box: no divider above the first row. */
  inList?: boolean;
}) {
  return (
    <RowShell
      id={row.id}
      done={row.done}
      readOnly={readOnly}
      className={cn(
        "item-row grid grid-cols-[44px_minmax(0,1fr)] items-start border-t border-line py-1 pr-4 pl-1 md:grid-cols-[44px_minmax(0,1fr)_auto]",
        inList && "first:border-t-0 pr-3",
      )}
    >
      <TickBox title={row.title} />
      <div className="item-text min-w-0 py-2.5">
        {row.index && <span className="type-num mr-1.5 text-muted">{row.index}</span>}
        {row.url ? (
          <ExternalLink href={row.url} className="item-title type-body-strong">
            {row.title}
          </ExternalLink>
        ) : (
          <span className="item-title type-body-strong [overflow-wrap:anywhere]">{row.title}</span>
        )}
        {row.meta && <span className="type-small block max-w-[34em] text-muted">{row.meta}</span>}
        {row.why && <span className="type-small block max-w-[34em] text-muted">{row.why}</span>}
        <TickError />
      </div>
      <NoteArea
        itemId={row.id}
        title={row.title}
        note={row.note}
        link={row.link}
        placeholder={row.notePlaceholder}
        readOnly={readOnly}
      />
      {row.resources && (
        <ResourceList
          taskId={row.id}
          summary={
            <>
              Learning resources <Count done={row.resources.done} total={row.resources.rows.length} className="font-medium" />
            </>
          }
        >
          {row.resources.start && (
            <p className="type-small mt-1 mb-2 max-w-[34em] text-muted">
              <b className="font-semibold text-ink">Start here:</b> {row.resources.start}
            </p>
          )}
          <ul className="rounded-md border border-line bg-sunk">
            {row.resources.rows.map((r) => (
              <ItemRow key={r.id} row={r} readOnly={readOnly} inList />
            ))}
          </ul>
        </ResourceList>
      )}
    </RowShell>
  );
}

/** The rows of a card. */
export function ItemList({ rows, readOnly }: { rows: RowModel[]; readOnly: boolean }) {
  return (
    <ul>
      {rows.map((r) => (
        <ItemRow key={r.id} row={r} readOnly={readOnly} />
      ))}
    </ul>
  );
}
