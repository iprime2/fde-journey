// The "example path" card on the /login brand panel, 1024 px and wider (design spec 4,
// JourneyPreview). Pure decoration: hidden from screen readers, and the stages and percentages
// are fixed, made-up and generic. Never fill it from saved progress. Server Component.
import { cn } from "./cn";

/** Label positions from the spec's drawing (viewBox 480 by 196). */
const STAGES = [
  { label: "Foundations", percent: "100%", x: 34, y: 190 },
  { label: "Retrieval", percent: "100%", x: 142, y: 166 },
  { label: "Agents", percent: "60%", x: 258, y: 126 },
  { label: "Evals", percent: "0%", x: 362, y: 88 },
] as const;

export function JourneyPreview({ className }: { className?: string }) {
  return (
    <figure
      aria-hidden="true"
      className={cn("w-full max-w-[30rem] rounded-xl border border-brand-line bg-brand-card px-5 pt-[18px] pb-4", className)}
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="font-display text-[15px] leading-[1.3] font-semibold text-brand-ink">Example path</span>
        <span className="type-label rounded-full bg-brand-chip px-2 py-[3px] text-brand-accent">Example</span>
      </div>
      <svg viewBox="0 0 480 196" className="block h-auto w-full" focusable="false">
        {/* The whole route, dashed. */}
        <path
          d="M20 170C70 166 92 150 128 142S200 112 240 102 312 74 348 64 420 38 452 30"
          fill="none"
          className="stroke-brand-faint"
          strokeWidth="2"
          strokeDasharray="2 6"
          strokeLinecap="round"
        />
        {/* The walked part: draws in once (globals.css, .path-draw). pathLength 1 makes the dash maths exact. */}
        <path
          d="M20 170C70 166 92 150 128 142S200 112 240 102"
          pathLength={1}
          fill="none"
          className="path-draw stroke-brand-accent"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <g className="path-node [animation-delay:0.2s]">
          <circle cx="20" cy="170" r="7" className="fill-brand-accent" />
        </g>
        <g className="path-node [animation-delay:0.5s]">
          <circle cx="128" cy="142" r="7" className="fill-brand-accent" />
        </g>
        <g className="path-node [animation-delay:0.9s]">
          {/* The current stage: a halo and a ring. */}
          <circle cx="240" cy="102" r="14" opacity=".18" className="fill-brand-accent" />
          <circle cx="240" cy="102" r="7" strokeWidth="3" className="fill-brand-card stroke-brand-accent" />
        </g>
        {/* Upcoming. */}
        <circle cx="348" cy="64" r="6" strokeWidth="2" className="fill-brand-card stroke-brand-faint" />
        {/* The logo's spark at the end of the route. */}
        <path d="M452 16l2.9 6.6 6.6 2.9-6.6 2.9L452 35l-2.9-6.6-6.6-2.9 6.6-2.9z" className="fill-brand-accent" />
        <g className="fill-brand-ink font-sans text-[13px] font-medium">
          {STAGES.map((s) => (
            <text key={s.label} x={s.x} y={s.y}>
              {s.label}
              <tspan dx="6" className="fill-brand-muted font-mono text-[12px]">
                {s.percent}
              </tspan>
            </text>
          ))}
          <text x="440" y="56" textAnchor="end">
            Ship
          </text>
        </g>
      </svg>
      <figcaption className="type-small mt-1.5 text-brand-muted">
        Illustration only. Your own progress shows after you sign in.
      </figcaption>
    </figure>
  );
}
