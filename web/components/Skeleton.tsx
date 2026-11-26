// Loading placeholders (design spec 4, Skeleton): sunk blocks shaped like the content.
import { cn } from "./cn";
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

/** Six tiles and the current-phase panel. */
export function HomeSkeleton() {
  return (
    <Wrapper>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="grid gap-2 rounded-lg border border-line bg-surface px-4 py-3.5">
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
