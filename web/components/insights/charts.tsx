// Insights charts (design spec 10.4 and 10.5): plain SVG made on the server, no library. Marks are
// SVG; every piece of text is HTML beside or over it, so it keeps the type scale and follows text
// zoom. Each chart is one `role="img"` with a short name, then its key, a hidden summary sentence
// and a native "Show as table" disclosure with the same numbers. Nothing here animates.
import { Fragment } from "react";
import {
  type ActivityRow,
  type Bar,
  CALENDAR_WEEKS,
  CELL_PITCH,
  type ChartKind,
  HEAT_KEY,
  type HeatCell,
  type HeatStep,
  type KindInfo,
  type MonthLabel,
  PLOT_HEIGHTS,
  WEEK_UNITS,
  type WeekLabel,
  type WeeklyRow,
} from "@/lib/insights-view";
import { cn } from "../cn";

// Written out in full so Tailwind finds the classes.
const KIND_BG: Record<ChartKind, string> = {
  roadmap: "bg-kind-roadmap",
  resources: "bg-kind-resources",
  reading: "bg-kind-reading",
  scaler: "bg-kind-scaler",
  certs: "bg-kind-certs",
  courses: "bg-kind-courses",
  projects: "bg-kind-projects",
};
const HEAT_BG: Record<HeatStep, string> = { 0: "bg-heat-0", 1: "bg-heat-1", 2: "bg-heat-2", 3: "bg-heat-3", 4: "bg-heat-4" };

const SWATCH = "size-3 flex-none rounded-[3px]";

// ---- Weekly bar chart

function Plot({ bars, height, className }: { bars: readonly Bar[]; height: number; className: string }) {
  return (
    <div className={cn("relative", className)} style={{ height }}>
      <svg
        viewBox={`0 0 ${bars.length * WEEK_UNITS} ${height}`}
        preserveAspectRatio="none"
        width="100%"
        height={height}
        aria-hidden="true"
        focusable="false"
        className="absolute inset-0 block"
      >
        {bars.map((bar, i) => (
          <g key={bar.weekStart}>
            {/* This week: a band behind its column (the bold labels carry it too). */}
            {bar.current && <rect x={i * WEEK_UNITS + 4} y={0} width={WEEK_UNITS - 8} height={height} className="fill-sunk" />}
            {bar.segments.map((s) => (
              <rect
                key={s.kind}
                x={i * WEEK_UNITS + 20}
                y={s.y}
                width={60}
                height={s.height}
                fill={`var(--kind-${s.kind})`}
                shapeRendering="crispEdges"
              />
            ))}
          </g>
        ))}
        <line x1={0} x2={bars.length * WEEK_UNITS} y1={height - 0.5} y2={height - 0.5} stroke="var(--line-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      </svg>
      {/* Totals over each bar. */}
      <div aria-hidden="true" className="absolute inset-0 grid grid-cols-12">
        {bars.map((bar) => (
          <div key={bar.weekStart} className="relative">
            <span
              data-total={bar.weekStart}
              className={cn("type-num absolute inset-x-0 text-center", bar.total === 0 ? "text-muted" : "text-ink", bar.current && "font-semibold")}
              style={{ bottom: bar.height + 4 }}
            >
              {bar.total}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The stacked weekly bar chart. Drawn twice from the same bars, at the phone height (below `md`) and
 * the wide height, so gaps and the baseline stay whole pixels at both; CSS shows one.
 */
export function WeeklyChart({
  phoneBars,
  wideBars,
  labels,
  keys,
  summary,
}: {
  phoneBars: readonly Bar[];
  wideBars: readonly Bar[];
  labels: readonly WeekLabel[];
  keys: readonly KindInfo[];
  summary: string;
}) {
  return (
    <>
      <div role="img" aria-label="Bar chart of items done per week, last 12 weeks">
        <Plot bars={phoneBars} height={PLOT_HEIGHTS.phone} className="md:hidden" />
        <Plot bars={wideBars} height={PLOT_HEIGHTS.wide} className="hidden md:block" />
        <div aria-hidden="true" className="type-num grid grid-cols-12 pt-1.5 text-center text-muted">
          {labels.map((l, i) => {
            const current = wideBars[i]?.current;
            return (
              <div key={wideBars[i]?.weekStart ?? i} className={cn("grid", current && "font-semibold text-ink")}>
                <span>{l.day}</span>
                <span>{l.month ?? " "}</span>
              </div>
            );
          })}
        </div>
      </div>
      <ul aria-label="Colour key" className="type-small mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-ink">
        {keys.map((k) => (
          <li key={k.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={cn(SWATCH, KIND_BG[k.key])} />
            {k.label}
          </li>
        ))}
      </ul>
      <p className="sr-only">{summary}</p>
    </>
  );
}

// ---- Activity calendar

/** Day labels beside rows 0, 2 and 4 (Monday at the top). */
const DAY_LABELS = [
  { row: 0, label: "Mon" },
  { row: 2, label: "Wed" },
  { row: 4, label: "Fri" },
] as const;

export function ActivityCalendar({ cells, months, summary }: { cells: readonly HeatCell[]; months: readonly MonthLabel[]; summary: string }) {
  const today = cells.find((c) => c.today);
  return (
    <>
      <div role="img" aria-label="Calendar of active days, last 26 weeks" className="mt-3 grid w-full max-w-[520px] grid-cols-[28px_minmax(0,1fr)] gap-x-1">
        <div />
        <div aria-hidden="true" className="relative h-[18px]">
          {months.map((m) => (
            <span key={`${m.col}-${m.label}`} className="type-num absolute top-0 whitespace-nowrap text-muted" style={{ left: `${(m.col / CALENDAR_WEEKS) * 100}%` }}>
              {m.label}
            </span>
          ))}
        </div>
        {/* The calendar sets the row's height; the labels add none, so they stay beside their rows
            however small the squares get (design spec 10.4). */}
        <div aria-hidden="true" className="relative">
          {DAY_LABELS.map(({ row, label }) => (
            <span
              key={label}
              className="type-num absolute left-0 -translate-y-1/2 whitespace-nowrap leading-none text-muted"
              style={{ top: `${((row + 0.5) / 7) * 100}%` }}
            >
              {label}
            </span>
          ))}
        </div>
        <svg viewBox={`0 0 ${CALENDAR_WEEKS * CELL_PITCH} ${7 * CELL_PITCH}`} aria-hidden="true" focusable="false" className="block h-auto w-full">
          {cells.map((c) => (
            <rect
              key={c.date}
              data-date={c.date}
              data-count={c.count}
              x={c.col * CELL_PITCH + 1}
              y={c.row * CELL_PITCH + 1}
              width={CELL_PITCH - 2}
              height={CELL_PITCH - 2}
              rx={1.5}
              fill={`var(--heat-${c.step})`}
            />
          ))}
          {today && (
            <rect
              x={today.col * CELL_PITCH}
              y={today.row * CELL_PITCH}
              width={CELL_PITCH}
              height={CELL_PITCH}
              rx={2}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <p className="type-label text-muted">Saves per day</p>
        <ul aria-label="Colour key" className="type-small flex flex-wrap gap-x-4 gap-y-1.5 text-ink">
          {HEAT_KEY.map((k) => (
            <li key={k.step} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cn(SWATCH, HEAT_BG[k.step])} />
              {k.label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className={cn(SWATCH, "border-2 border-ink bg-surface")} />
            Today
          </li>
        </ul>
      </div>
      <p className="sr-only">{summary}</p>
    </>
  );
}

// ---- "Show as table"

/** A native disclosure, closed on every load. The two labels swap with the open state. */
export function TableDisclosure({ children }: { children: React.ReactNode }) {
  return (
    <details className="group mt-1">
      <summary className="type-small flex min-h-11 w-fit items-center gap-1.5 rounded-sm font-semibold text-accent">
        <span aria-hidden="true" className="inline-block font-mono group-open:rotate-90 motion-safe:transition-transform motion-safe:duration-200">
          ›
        </span>
        <span className="group-open:hidden">Show as table</span>
        <span className="hidden group-open:inline">Hide table</span>
      </summary>
      {children}
    </details>
  );
}

const TH = "type-label border-b border-line px-2 py-2 text-muted";
const ROW_HEAD = "type-num h-11 px-2 py-2 text-left align-top font-medium";
const CELL = "h-11 px-2 py-2 align-top";

function WeekOf({ label, current }: { label: string; current: boolean }) {
  return (
    <>
      <span className="block">{label}</span>
      {current && <span className="type-small block font-sans font-normal text-muted">this week</span>}
    </>
  );
}

/**
 * "Roadmap tasks 2 · Learning resources 3": each entry an inline span carrying its own trailing
 * " ·" (joined by a no-break space), so a wrapped line never starts with the separator (spec 10.5).
 */
function Entries({ items }: { items: readonly string[] }) {
  return items.map((item, i) => (
    <Fragment key={item}>
      <span>
        {/* No-break spaces tie the count to its label and the "·" to the entry: a line may break
            only between entries, after the separator. */}
        {item.replace(/ (\d+)$/, "\u00a0$1")}
        {i < items.length - 1 && "\u00a0·"}
      </span>
      {i < items.length - 1 && " "}
    </Fragment>
  ));
}

export function WeeklyTable({ rows }: { rows: readonly WeeklyRow[] }) {
  return (
    <table className="mt-1 w-full table-fixed border-collapse">
      <caption className="sr-only">Items done per week, last 12 weeks, newest first</caption>
      <thead>
        <tr>
          <th scope="col" className={cn(TH, "w-[72px] text-left md:w-24")}>
            Week of
          </th>
          <th scope="col" className={cn(TH, "w-14 text-right")}>
            Done
          </th>
          <th scope="col" className={cn(TH, "text-left")}>
            By kind
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.weekStart} className="border-t border-line first:border-t-0">
            <th scope="row" className={ROW_HEAD}>
              <WeekOf label={r.label} current={r.current} />
            </th>
            <td className={cn(CELL, "type-num text-right")}>{r.total}</td>
            <td className={cn(CELL, "type-small [overflow-wrap:anywhere]", !r.byKind && "text-muted")}>
              {r.byKind ? <Entries items={r.byKind} /> : "Nothing done"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ActivityTable({ rows }: { rows: readonly ActivityRow[] }) {
  return (
    <table className="mt-1 w-full table-fixed border-collapse">
      <caption className="sr-only">Active days per week, last 26 weeks, newest first</caption>
      <thead>
        <tr>
          <th scope="col" className={cn(TH, "w-[72px] text-left md:w-24")}>
            Week of
          </th>
          <th scope="col" className={cn(TH, "w-[72px] text-right")}>
            Active days
          </th>
          <th scope="col" className={cn(TH, "text-left")}>
            Saves by day
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.weekStart} className="border-t border-line first:border-t-0">
            <th scope="row" className={ROW_HEAD}>
              <WeekOf label={r.label} current={r.current} />
            </th>
            <td className={cn(CELL, "type-num text-right")}>{r.activeDays}</td>
            <td className={cn(CELL, "type-small [overflow-wrap:anywhere]", !r.savesByDay && "text-muted")}>
              {r.savesByDay ? <Entries items={r.savesByDay} /> : "No activity"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
