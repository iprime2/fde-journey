"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * After a client navigation, move focus to the new page's h1 so keyboard and screen-reader users
 * start at the top of the page (design spec 7). Not on the first load. Earlier pages can stay in
 * the document, hidden, so pick the h1 that is rendered.
 */
export function RouteFocus() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const heading = [...document.querySelectorAll<HTMLElement>("main h1")].find((h) => h.getClientRects().length > 0);
    heading?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}
