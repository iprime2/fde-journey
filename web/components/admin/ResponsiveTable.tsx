// DataTable from 1280 px and CardList below it (design spec 3.4 and 4): both rendered from the
// same rows, one shown with CSS, so only one is in the accessibility tree. No hooks, so Server and
// Client Components can use it.
import { CARD_STYLES } from "../Card";
import { cn } from "../cn";

export interface Column<R> {
  key: string;
  header: string;
  /** Width and alignment classes for the header and its cells. */
  className?: string;
  align?: "right";
  /** The person cell: a <th scope="row">. */
  rowHeader?: boolean;
  cell(row: R): React.ReactNode;
}

export function ResponsiveTable<R>({
  caption,
  columns,
  rows,
  rowKey,
  card,
}: {
  /** What is shown and how it is sorted ("People, newest sign-up first. 3 of 42 shown."). */
  caption: string;
  columns: Column<R>[];
  rows: R[];
  rowKey(row: R): string;
  /** One card per row below 1280 px. */
  card(row: R): React.ReactNode;
}) {
  return (
    <>
      <div className={cn(CARD_STYLES, "hidden xl:block")}>
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn("type-label border-b border-line px-3 py-2.5 text-muted", c.align === "right" ? "text-right" : "text-left", c.className)}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-t border-line first:border-t-0">
                {columns.map((c) => {
                  const Cell = c.rowHeader ? "th" : "td";
                  return (
                    <Cell
                      key={c.key}
                      scope={c.rowHeader ? "row" : undefined}
                      className={cn("h-14 px-3 py-2 align-middle font-normal", c.align === "right" ? "text-right" : "text-left", c.className)}
                    >
                      {c.cell(row)}
                    </Cell>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul aria-label={caption} className="grid gap-3 xl:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className={cn(CARD_STYLES, "grid gap-3 px-4 py-3.5")}>
            {card(row)}
          </li>
        ))}
      </ul>
    </>
  );
}

/** A card's facts: two columns from 360 px, one below. */
export function CardFacts({ facts }: { facts: { term: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 min-[360px]:grid-cols-2">
      {facts.map((f) => (
        <div key={f.term} className="grid min-w-0 content-start gap-0.5">
          <dt className="type-label text-muted">{f.term}</dt>
          <dd className="type-small [overflow-wrap:anywhere]">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** EmptyState (design spec 4): dashed box, small muted text, an optional button. */
export function EmptyBox({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="type-small grid justify-items-center gap-3 rounded-lg border border-dashed border-line bg-surface p-7 text-center text-muted">
      <p>{children}</p>
      {action}
    </div>
  );
}

/** Focuses the first element matching `selector` that is on screen (the table or the cards). */
export function focusVisible(selector: string): boolean {
  const el = [...document.querySelectorAll<HTMLElement>(selector)].find((e) => e.getClientRects().length > 0);
  el?.focus();
  return !!el;
}
