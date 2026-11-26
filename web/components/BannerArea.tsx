"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BACK_ONLINE_BANNER, type BannerSpec, OFFLINE_BANNER, pickBanners } from "@/lib/banners";
import { Banner } from "./Banner";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Online, offline, or back online (shown for 4 seconds after the connection returns). */
function useConnectionBanner(): BannerSpec | null {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  const [previous, setPrevious] = useState(online);
  const [backOnline, setBackOnline] = useState(false);
  if (online !== previous) {
    setPrevious(online);
    setBackOnline(online);
  }
  useEffect(() => {
    if (!backOnline) return;
    const timer = window.setTimeout(() => setBackOnline(false), 4000);
    return () => window.clearTimeout(timer);
  }, [backOnline]);
  if (!online) return OFFLINE_BANNER;
  return backOnline ? BACK_ONLINE_BANNER : null;
}

/** The page's banners plus the connection banner: at most two, the most serious first. */
export function BannerArea({ banners }: { banners: BannerSpec[] }) {
  const connection = useConnectionBanner();
  const shown = pickBanners([connection, ...banners]);
  if (shown.length === 0) return null;
  return (
    <div className="grid gap-2">
      {shown.map((b) => (
        <Banner key={b.id} tone={b.tone}>
          {b.text}
        </Banner>
      ))}
    </div>
  );
}
