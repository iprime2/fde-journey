"use client";

// Phone and tablet navigation, below 1024 px (design spec 3.1): five cells at the bottom of the
// screen, the last one opening the "More" sheet with Certifications, Projects, Career and the
// account row. On short screens (phone landscape) the bar is 48 px with icons beside the labels.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../cn";
import { EllipsisIcon } from "../icons";
import { SECTIONS, isCurrentSection } from "./sections";

const BAR = SECTIONS.filter((s) => s.phone === "bar");
const MORE = SECTIONS.filter((s) => s.phone === "more");

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

export function BottomBar({ account }: { account?: React.ReactNode }) {
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

  const moreIsCurrent = MORE.some((s) => isCurrentSection(pathname, s.href));

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
        className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] short:bottom-[calc(48px+env(safe-area-inset-bottom))] z-40 rounded-t-lg bg-surface pr-[max(16px,env(safe-area-inset-right))] pl-[max(16px,env(safe-area-inset-left))] py-2 shadow-overlay"
      >
        <ul>
          {MORE.map((s) => {
            const current = isCurrentSection(pathname, s.href);
            return (
              <li key={s.href}>
                <Link
                  href={s.href}
                  aria-current={current ? "page" : undefined}
                  onClick={() => close(current)}
                  className={cn(
                    "flex min-h-[52px] items-center gap-3 rounded-md px-3 type-body-strong",
                    current ? "bg-accent-soft text-ink" : "text-ink hover:bg-hover",
                  )}
                >
                  <s.Icon size={22} className={current ? "text-accent" : "text-muted"} />
                  {s.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 border-t border-line pt-2">{account}</div>
      </div>
      {/* The background runs to the screen edges; the cells stay clear of a side notch. */}
      <ul className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(64px+env(safe-area-inset-bottom))] grid-cols-5 border-t border-line bg-surface pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] short:h-[calc(48px+env(safe-area-inset-bottom))]">
        {BAR.map((s) => {
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
