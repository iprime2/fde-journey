// Home: summary tiles and the current-phase panel (design spec 4, StatTile and NowPanel).
// Server Components.
import Link from "next/link";
import { useId } from "react";
import type { NowModel, TileModel } from "@/lib/summary";
import { percent } from "@/lib/summary";
import { CARD_STYLES } from "./Card";
import { cn } from "./cn";
import { ProgressBar, StatusChip } from "./ui";

export function StatTile({ tile }: { tile: TileModel }) {
  return (
    <Link
      href={tile.href}
      className="grid min-w-0 content-start gap-1 rounded-lg border border-line bg-surface px-4 py-3.5 hover:border-line-strong motion-safe:transition-[color,background-color,border-color] motion-safe:duration-150"
    >
      <span className="type-num-lg">
        <span aria-hidden="true">{tile.value}</span>
        <span className="sr-only">{tile.valueLabel},</span>
      </span>
      <span className="type-small text-muted">{tile.label}</span>
      <ProgressBar percent={tile.percent} className="mt-1.5" />
    </Link>
  );
}

/**
 * Grids by tile count (design spec 5, Home with hidden sections): 5 or 6 tiles 2 columns, 3 from
 * 768 px; 4 tiles 2 by 2, one row from 1280 px; 3 tiles one row from 768 px, and below it the
 * third spans both columns.
 */
const TILE_GRID: Record<number, string> = {
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 xl:grid-cols-4",
};

export function StatTiles({ tiles }: { tiles: TileModel[] }) {
  return (
    <section aria-label="Summary">
      <ul className={cn("grid gap-3", TILE_GRID[tiles.length] ?? "grid-cols-2 md:grid-cols-3")}>
        {tiles.map((t, i) => (
          <li key={t.key} className={cn("grid", tiles.length === 3 && i === 2 && "col-span-2 md:col-span-1")}>
            <StatTile tile={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const KICKER = "type-label text-muted";

/** `showScaler`: the Scaler part shows only while that section is on (design spec 5). */
export function NowPanel({ now, showScaler = true }: { now: NowModel; showScaler?: boolean }) {
  const { phase, module, upNext } = now;
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn(CARD_STYLES, "grid gap-5 p-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]")}
    >
      <div className="grid min-w-0 content-start gap-2">
        <p className={KICKER}>Roadmap · {phase.range}</p>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h2 id={titleId} className="type-title">
            Phase {phase.n} · {phase.title}
          </h2>
          <StatusChip chip={phase.chip} />
        </div>
        <p className="type-num text-muted">
          {phase.done}/{phase.total} tasks done
        </p>
        <ProgressBar percent={percent(phase)} />
        {showScaler && (
          <>
            <p className={cn(KICKER, "mt-2")}>Scaler · Module {module.n}</p>
            <p>
              {module.title}: {module.sub}
            </p>
            <p className="type-small text-muted">
              <span className="type-num">
                {module.done}/{module.total} classes
              </span>
              {module.nextClass && ` · next: ${module.nextClass}`}
            </p>
          </>
        )}
      </div>
      <div className="min-w-0">
        <h3 className={KICKER}>Up next this phase</h3>
        {upNext.length > 0 ? (
          <ul className="mt-2 grid gap-1">
            {upNext.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/roadmap#item-${t.id}`}
                  className="flex min-h-11 items-start gap-2 rounded-sm py-2.5 hover:text-accent"
                >
                  <span aria-hidden="true" className="font-mono text-accent">
                    →
                  </span>
                  <span className="min-w-0 [overflow-wrap:anywhere]">{t.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-num mt-2 text-muted">All tasks in this phase are done.</p>
        )}
      </div>
    </section>
  );
}
