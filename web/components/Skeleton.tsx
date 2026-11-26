// Loading placeholders (design spec 4, Skeleton): sunk blocks shaped like the content.
import { cn } from "./cn";
import { tileGridClass, tileSpanClass } from "./home";
import { StillLoading } from "./StillLoading";

const BLOCK = "rounded-sm bg-sunk motion-safe:animate-skeleton";

function Block({ className }: { className: string }) {
  return <div className={cn(BLOCK, className)} />;
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
