// Loading placeholders (design spec 4, Skeleton): sunk blocks shaped like the content.
import { cn } from "./cn";
import { tileGridClass, tileSpanClass } from "./home";
import { StillLoading } from "./StillLoading";

const BLOCK = "rounded-sm bg-sunk motion-safe:animate-skeleton";

function Block({ className, style }: { className: string; style?: React.CSSProperties }) {
  return <div className={cn(BLOCK, className)} style={style} />;
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div aria-busy="true" className="grid gap-3">
      <span className="sr-only">Loading</span>
      {children}
      <StillLoading />
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-lg border border-line bg-surface">
      <div className="grid gap-2 px-4 py-3.5">
        <Block className="h-5 w-1/2" />
        <Block className="h-3.5 w-1/4" />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 border-t border-line px-4 py-3">
          <Block className="size-5 shrink-0" />
          <Block className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

/** Toolbar block and three cards of four rows. */
export function ListSkeleton() {
  return (
    <Wrapper>
      <Block className="h-11 w-full" />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </Wrapper>
  );
}

/**
 * Seven tiles in the 7-tile layout (the owner's Home; design spec 4, Skeleton, v0.7) and the
 * current-phase panel. The tile count depends on the person's sections, which load with the
 * tiles, so the skeleton draws the most common case, from the same grid helpers as StatTiles.
 */
const SKELETON_TILES = 7;

export function HomeSkeleton() {
  return (
    <Wrapper>
      <div className={cn("grid gap-3", tileGridClass(SKELETON_TILES))}>
        {Array.from({ length: SKELETON_TILES }, (_, i) => (
          <div key={i} className={cn("grid gap-2 rounded-lg border border-line bg-surface px-4 py-3.5", tileSpanClass(SKELETON_TILES, i))}>
            <Block className="h-7 w-16" />
            <Block className="h-3.5 w-3/4" />
            <Block className="h-1.5 w-full" />
          </div>
        ))}
      </div>
      {/* The Insights link line (design spec 10.7). */}
      <div className="flex h-11 items-center">
        <Block className="h-3.5 w-2/5" />
      </div>
      <CardSkeleton />
    </Wrapper>
  );
}

/** Settings and admin pages: `cards` plain cards (no toolbar). */
export function CardsSkeleton({ cards = 2, rows = 3 }: { cards?: number; rows?: number }) {
  return (
    <Wrapper>
      {Array.from({ length: cards }, (_, c) => (
        <div key={c} className="rounded-lg border border-line bg-surface">
          <div className="grid gap-2 px-4 py-3.5">
            <Block className="h-5 w-1/3" />
            <Block className="h-3.5 w-2/3" />
          </div>
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-3 border-t border-line px-4 py-4">
              <Block className="h-4 flex-1" />
              <Block className="h-6 w-11 shrink-0" />
            </div>
          ))}
        </div>
      ))}
    </Wrapper>
  );
}

/** A card's head: a 20 px line at 33% and a 14 px line at 66% (design spec 10.2). */
function HeadBlocks() {
  return (
    <div className="grid gap-2 px-4 py-3.5">
      <Block className="h-5 w-1/3" />
      <Block className="h-3.5 w-2/3" />
    </div>
  );
}

const SKELETON_CARD = "rounded-lg border border-line bg-surface";
/** Bar heights of the weekly chart's skeleton, as % of the plot (design spec 10.2 B). */
const SKELETON_BARS = [35, 55, 45, 70, 60, 85, 50, 65, 90, 60, 75, 40];

/**
 * Insights (design spec 10.6): the blocks of 10.2 in page order at their real sizes, with Current
 * phase and This month side by side from xl, and the Certifications card (on for most people).
 */
export function InsightsSkeleton() {
  return (
    <Wrapper>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn("grid gap-2 rounded-lg border border-line bg-surface px-4 py-3.5", i === 0 && "col-span-2 md:col-span-1")}>
            <Block className="h-7 w-12" />
            <Block className="h-3.5 w-3/4" />
          </div>
        ))}
      </div>
      <Block className="h-3.5 w-4/5" />
      <div className={SKELETON_CARD}>
        <HeadBlocks />
        <div className="grid gap-3 px-4 pb-4">
          <div className="grid h-40 grid-cols-12 items-end md:h-50">
            {SKELETON_BARS.map((h, i) => (
              <div key={i} className="flex h-full items-end justify-center">
                <Block className="w-3/5" style={{ height: `${h}%` }} />
              </div>
            ))}
          </div>
          <Block className="h-3.5 w-1/2" />
        </div>
      </div>
      <div className={SKELETON_CARD}>
        <HeadBlocks />
        <div className="grid gap-3 px-4 pb-4">
          <Block className="h-3.5 w-3/5" />
          <Block className="ml-8 aspect-[26/7] w-full max-w-[488px]" />
          <Block className="h-3.5 w-2/5" />
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <div className={SKELETON_CARD}>
          <HeadBlocks />
          <div className="grid gap-3 px-4 pb-4">
            <Block className="h-1.5 w-full" />
            <Block className="h-3.5 w-2/3" />
            <Block className="h-3.5 w-1/2" />
          </div>
        </div>
        <div className={SKELETON_CARD}>
          <HeadBlocks />
          <div className="grid grid-cols-2 gap-3 px-4 pb-4">
            {[0, 1].map((i) => (
              <div key={i} className="grid gap-2">
                <Block className="h-7 w-8" />
                <Block className="h-3.5 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={SKELETON_CARD}>
        <HeadBlocks />
        <div className="grid xl:grid-cols-2 xl:gap-x-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="grid gap-2 border-t border-line px-4 py-3">
              <Block className="h-4 w-2/3" />
              <Block className="h-1.5 w-full" />
            </div>
          ))}
        </div>
      </div>
    </Wrapper>
  );
}
