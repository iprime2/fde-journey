"use client";

import { useEffect } from "react";

/**
 * Sets the tab's title in the browser. For the in-app not-found page: a notFound() that arrives
 * after the page started streaming can't change the <title> the page already sent, and the page's
 * own metadata can write it back after this mounts, so it is kept while this is on screen.
 */
export function DocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    const keep = () => {
      if (document.title !== title) document.title = title;
    };
    keep();
    const observer = new MutationObserver(keep);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [title]);
  return null;
}
