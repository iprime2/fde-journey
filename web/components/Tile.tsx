// StatTile, plain variant (design spec 4, v0.5): the tile's box as a `<div>`, or a link when there is
// a page to open. Used by the admin Overview and Insights' "At a glance" (spec 10.2 A).
import Link from "next/link";
import { cn } from "./cn";

const TILE = "grid min-w-0 content-start gap-1 rounded-lg border border-line bg-surface px-4 py-3.5";

/**
 * `srValue` is read instead of the number (for example "42 of 100 places taken"). `srOnly` is read
 * instead of the number and the label, when one sentence says both ("5 items done this week, 7 last
 * week").
 */
export function Tile({
  value,
  label,
  srValue,
  srOnly,
  href,
  className,
  children,
}: {
  value: string;
  label: string;
  srValue?: string;
  srOnly?: string;
  href?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const inner = (
    <>
      <span className="type-num-lg">
        <span aria-hidden={srValue || srOnly ? true : undefined}>{value}</span>
        {srValue && <span className="sr-only">{srValue},</span>}
        {srOnly && <span className="sr-only">{srOnly}</span>}
      </span>
      <span aria-hidden={srOnly ? true : undefined} className="type-small text-muted">
        {label}
      </span>
      {children}
    </>
  );
  return href ? (
    <Link href={href} className={cn(TILE, "hover:border-line-strong motion-safe:transition-[border-color] motion-safe:duration-150", className)}>
      {inner}
    </Link>
  ) : (
    <div className={cn(TILE, className)}>{inner}</div>
  );
}
