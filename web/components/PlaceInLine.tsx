// PlaceInLine (design spec 4, v0.5): the waitlisted person's place, on /waitlist. Server Component.
import { aheadLine, formatCount } from "@/lib/admin-format";

const PANEL = "grid gap-0.5 rounded-md bg-sunk px-4 py-3.5";

export function PlaceInLine({ place }: { place: number }) {
  return (
    <div className={PANEL}>
      <p className="type-label text-muted">
        Your place in line<span className="sr-only">:</span>
      </p>
      <p className="type-num-lg text-ink">
        <span className="sr-only">Number </span>
        {formatCount(place)}
      </p>
      <p className="type-small text-muted">{aheadLine(place)}</p>
    </div>
  );
}

/** Same size as the panel, while the place loads. */
export function PlaceInLineSkeleton() {
  return (
    <div aria-busy="true" className={PANEL}>
      <span className="sr-only">Loading your place</span>
      <span className="my-px h-3.5 w-32 rounded-sm bg-line motion-safe:animate-skeleton" />
      <span className="my-1 h-6 w-10 rounded-sm bg-line motion-safe:animate-skeleton" />
      <span className="my-0.5 h-3.5 w-44 rounded-sm bg-line motion-safe:animate-skeleton" />
    </div>
  );
}
