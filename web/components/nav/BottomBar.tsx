"use client";

// Phone and tablet navigation, below 1024 px (design spec 3.1 and 3.5): Home and the first three
// visible sections at the bottom of the screen, then More, which opens a sheet with the other
// visible sections, Settings, Admin (admins only) and the account row. On short screens (phone
// landscape) the bar is 48 px with icons beside the labels.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../cn";
import { EllipsisIcon } from "../icons";
import { ADMIN_ITEM, SETTINGS_ITEM, type ExtraItem, isCurrentExtra, isCurrentSection, sectionFor } from "./sections";

/** What the bar shows. Null while the user's sections stream in: Home and Roadmap, two empty cells and More. */
export interface PhoneNav {
  bar: readonly string[];
  more: readonly string[];
  adminHref: string | null;
}

const LOADING: PhoneNav = { bar: ["/", "/roadmap", "", ""], more: [], adminHref: null };

/** The current-page pill: above the icon, or on its left in the compact bar. */
function Pill() {
  return (
    <span
      aria-hidden="true"
      className="absolute top-0 h-[3px] w-6 rounded-full bg-accent short:static short:h-6 short:w-[3px] short:flex-none"
    />
  );
}

// Inset focus ring, so it is not clipped at the screen edge.
const CELL =
  "relative flex min-h-12 w-full flex-col items-center justify-center gap-1 pt-1 type-tab-label focus-visible:outline-offset-[-2px] short:flex-row short:gap-1.5 short:pt-0";
// 22 px icons; 20 px in the compact bar.
const ICON = "short:size-5";

export function BottomBar({ nav, account }: { nav: PhoneNav | null; account?: React.ReactNode }) {
  const { bar, more, adminHref } = nav ?? LOADING;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sheetId = useId();
  const moreButton = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  // A navigation (including Back) closes the sheet.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const extras: { item: ExtraItem; href: string }[] = [
    { item: "settings", href: "/settings" },
    ...(adminHref ? [{ item: "admin" as const, href: adminHref }] : []),
  ];
  const moreIsCurrent = more.some((href) => isCurrentSection(pathname, href)) || extras.some((e) => isCurrentExtra(pathname, e.item));

  const row = (key: string, href: string, label: string, Icon: (p: { size?: number; className?: string }) => React.ReactNode, current: boolean) => (
    <li key={key}>
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        onClick={() => close(current)}
        className={cn(
          "flex min-h-[52px] items-center gap-3 rounded-md px-3 type-body-strong",
          current ? "bg-accent-soft text-ink" : "text-ink hover:bg-hover",
        )}
      >
        <Icon size={22} className={current ? "text-accent" : "text-muted"} />
        {label}
      </Link>
    </li>
  );

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) moreButton.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    sheet.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        moreButton.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <nav aria-label="Sections" className="lg:hidden">
      {open && <div aria-hidden="true" className="fixed inset-0 z-30 bg-scrim" onClick={() => close(true)} />}
      <div
        ref={sheet}
        id={sheetId}
        hidden={!open}
        onBlur={(e) => {
          const next = e.relatedTarget as Node | null;
          if (next && !sheet.current?.contains(next) && next !== moreButton.current) setOpen(false);
        }}
        // Never runs off the top of the screen (design spec 3.1, sheet height): it scrolls on its
        // own when its rows don't fit above the bar, as in phone landscape.
        className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] short:bottom-[calc(48px+env(safe-area-inset-bottom))] z-40 max-h-[calc(100dvh_-_64px_-_env(safe-area-inset-bottom)_-_max(8px,env(safe-area-inset-top)))] short:max-h-[calc(100dvh_-_48px_-_env(safe-area-inset-bottom)_-_max(8px,env(safe-area-inset-top)))] overflow-y-auto overscroll-contain rounded-t-lg bg-surface pr-[max(16px,env(safe-area-inset-right))] pl-[max(16px,env(safe-area-inset-left))] py-2 shadow-overlay"
      >
        {/* On wider screens (tablets, phone landscape) the rows keep a readable width. */}
        <div className="md:mx-auto md:max-w-[560px]">
          {more.length > 0 && (
            <ul className="mb-2 border-b border-line pb-2">
              {more.map((href) => {
                const section = sectionFor(href);
                return section ? row(href, href, section.label, section.Icon, isCurrentSection(pathname, href)) : null;
              })}
            </ul>
          )}
          <ul>
            {extras.map(({ item, href }) => {
              const entry = item === "settings" ? SETTINGS_ITEM : ADMIN_ITEM;
              return row(item, href, entry.label, entry.Icon, isCurrentExtra(pathname, item));
            })}
          </ul>
          <div className="mt-2 border-t border-line pt-2">{account}</div>
        </div>
      </div>
      {/* The background runs to the screen edges; the cells stay clear of a side notch. */}
      <ul
        style={{ gridTemplateColumns: `repeat(${bar.length + 1}, minmax(0, 1fr))` }}
        className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(64px+env(safe-area-inset-bottom))] border-t border-line bg-surface pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] short:h-[calc(48px+env(safe-area-inset-bottom))]"
      >
        {bar.map((href, i) => {
          const s = sectionFor(href);
          // A cell waiting for the user's sections.
          if (!s) return <li key={`empty-${i}`} aria-hidden="true" />;
          const current = isCurrentSection(pathname, s.href);
          return (
            <li key={s.href} className="flex">
              <Link
                href={s.href}
                aria-current={current ? "page" : undefined}
                className={cn(CELL, current ? "text-accent" : "text-muted hover:text-ink")}
              >
                {current && <Pill />}
                <s.Icon size={22} className={ICON} />
                {s.shortLabel ?? s.label}
              </Link>
            </li>
          );
        })}
        {/* Teal and the pill mark the current page only; an open sheet just shows More in ink. */}
        <li className="flex">
          <button
            ref={moreButton}
            type="button"
            aria-expanded={open}
            aria-controls={sheetId}
            onClick={() => setOpen((o) => !o)}
            className={cn(CELL, moreIsCurrent ? "text-accent" : open ? "text-ink" : "text-muted hover:text-ink")}
          >
            {moreIsCurrent && <Pill />}
            <EllipsisIcon size={22} className={ICON} />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
