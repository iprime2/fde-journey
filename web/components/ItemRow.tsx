// Every task, class, resource, paper, book and milestone (design spec 4, ItemRow).
// Server Component; the row element itself is a small client wrapper that hides it when filtered.
import { isHttpsUrl, notePreview } from "@/lib/notes";
import type { RowModel } from "@/lib/views";
import { cn } from "./cn";
import { FilterRow } from "./filter/Filtered";
import { CheckIcon } from "./icons";
import { ResourceList } from "./ResourceList";
import { Count, ExternalLink } from "./ui";

export function TickBox({ title, done, disabled }: { title: string; done: boolean; disabled: boolean }) {
  return (
    <label className={cn("relative grid size-11 place-items-center", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
      <input type="checkbox" className="tick peer" defaultChecked={done} disabled={disabled} aria-label={`Mark done: ${title}`} />
      <CheckIcon size={14} className="pointer-events-none absolute hidden text-accent-ink peer-checked:block" />
    </label>
  );
}

/** Note and link under the title when a note exists (design spec 4, NotePreview). */
export function NotePreview({ note, link }: { note: string; link: string }) {
  if (!note && !link) return null;
  return (
    <div className="type-small mt-1 whitespace-pre-wrap text-muted [overflow-wrap:anywhere]">
      {note && <p>{notePreview(note)}</p>}
      {link &&
        (isHttpsUrl(link) ? (
          <p>
            <ExternalLink href={link}>{link}</ExternalLink>
          </p>
        ) : (
          <p>{link}</p>
        ))}
    </div>
  );
}

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
  const titleClass = cn("type-body-strong", row.done && "text-muted line-through");
  return (
    <FilterRow
      id={row.id}
      className={cn(
        "grid grid-cols-[44px_minmax(0,1fr)] items-start border-t border-line py-1 pr-4 pl-1 md:grid-cols-[44px_minmax(0,1fr)_auto]",
        inList && "first:border-t-0 pr-3",
      )}
    >
      <TickBox title={row.title} done={row.done} disabled={readOnly} />
      <div className="min-w-0 py-2.5">
        {row.index && <span className="type-num mr-1.5 text-muted">{row.index}</span>}
        {row.url ? (
          <ExternalLink href={row.url} className={cn(titleClass, row.done && "[text-decoration-line:underline_line-through]")}>
            {row.title}
          </ExternalLink>
        ) : (
          <span className={cn(titleClass, "[overflow-wrap:anywhere]")}>{row.title}</span>
        )}
        {row.meta && <span className="type-small block text-muted">{row.meta}</span>}
        {row.why && <span className="type-small block text-muted">{row.why}</span>}
        {/* Notes stay readable when the row is read-only (none exist until saving arrives in M2). */}
        <NotePreview note={row.note} link={row.link} />
      </div>
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
            <p className="type-small mt-1 mb-2 max-w-[65ch] text-muted">
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
    </FilterRow>
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
