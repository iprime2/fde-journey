"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BACK_ONLINE_BANNER, type BannerSpec, OFFLINE_BANNER, SAVE_FAILED_BANNER, pickBanners, signedOutBanner } from "@/lib/banners";
import { loginHref } from "@/lib/login";
import { Banner } from "./Banner";
import { useSaveStatus } from "./save/SaveStatusProvider";
import { useOnline } from "./useOnline";

/** Offline, or back online (shown for 4 seconds after the connection returns). */
function useConnectionBanner(): BannerSpec | null {
  const online = useOnline();
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

/**
 * The page's banners plus the ones the browser knows about (signed out while using, a failed
 * save, the connection): at most two, the most serious first.
 */
export function BannerArea({ banners }: { banners: BannerSpec[] }) {
  const connection = useConnectionBanner();
  const save = useSaveStatus();
  const pathname = usePathname();
  const shown = pickBanners([
    save.signedOut && signedOutBanner(loginHref(pathname)),
    save.failed.size > 0 && SAVE_FAILED_BANNER,
    connection,
    ...banners,
  ]);
  if (shown.length === 0) return null;
  return (
    <div className="grid gap-2">
      {shown.map((b) => (
        <Banner key={b.id} tone={b.tone} action={b.action}>
          {b.text}
        </Banner>
      ))}
    </div>
  );
}
