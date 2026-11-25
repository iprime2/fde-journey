"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../cn";
import { SECTIONS, isCurrentSection } from "./sections";

/** A desktop sidebar link (design spec 3.2). `count` is rendered on the server. */
export function NavLink({ href, count }: { href: string; count?: React.ReactNode }) {
  const pathname = usePathname();
  const section = SECTIONS.find((s) => s.href === href);
  if (!section) return null;
  const current = isCurrentSection(pathname, href);
  const { Icon } = section;
  return (
    <Link
      href={section.href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-md px-3 motion-safe:transition-colors motion-safe:duration-150",
        current ? "bg-accent-soft text-ink" : "text-ink hover:bg-hover",
      )}
    >
      <Icon size={20} className={current ? "text-accent" : "text-muted"} />
      <span className="type-body-strong flex-1">{section.label}</span>
      {count}
    </Link>
  );
}
