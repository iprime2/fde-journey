"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "../cn";
import { ADMIN_ITEM, type ExtraItem, SETTINGS_ITEM, isCurrentExtra, isCurrentSection, sectionFor } from "./sections";

/**
 * A desktop sidebar link (design spec 3.2): a section (looked up by `href`), or Settings or Admin
 * (`item`, design spec 3.5; Admin is current on every admin page). `count` is rendered on the server.
 */
export function NavLink({ href, item, count }: { href: string; item?: ExtraItem; count?: React.ReactNode }) {
  const pathname = usePathname();
  const entry = item ? (item === "settings" ? SETTINGS_ITEM : ADMIN_ITEM) : sectionFor(href);
  const current = !!entry && (item ? isCurrentExtra(pathname, item) : isCurrentSection(pathname, href));
  const link = useRef<HTMLAnchorElement>(null);
  // On short windows the sidebar's links scroll (1024×600): keep the current one in view. Only the
  // links' own box scrolls, never the page.
  useEffect(() => {
    const el = link.current;
    const box = el?.closest("nav");
    if (!current || !el || !box || box.scrollHeight <= box.clientHeight) return;
    const top = el.offsetTop - box.offsetTop;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (top + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + el.offsetHeight - box.clientHeight;
  }, [current]);
  if (!entry) return null;
  const { Icon } = entry;
  return (
    <Link
      ref={link}
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-md px-3 motion-safe:transition-[color,background-color,border-color] motion-safe:duration-150",
        current ? "bg-accent-soft text-ink" : "text-ink hover:bg-hover",
      )}
    >
      <Icon size={20} className={current ? "text-accent" : "text-muted"} />
      <span className="type-body-strong flex-1">{entry.label}</span>
      {count}
    </Link>
  );
}
