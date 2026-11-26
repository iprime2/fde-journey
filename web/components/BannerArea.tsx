"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { BACK_ONLINE_BANNER, type BannerSpec, OFFLINE_BANNER, SAVE_FAILED_BANNER, pickBanners, signedOutBanner } from "@/lib/banners";
import { loginHref } from "@/lib/login";
import { Banner } from "./Banner";
import { useSaveStatus } from "./save/SaveStatusProvider";
import { useOnline } from "./useOnline";

/** Offline, or back online (shown for 4 seconds after the connection returns). */
function useConnectionBanner(online: boolean): BannerSpec | null {
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

const noUnsavedOnServer = () => false;

/**
 * The page's banners plus the ones the browser knows about (signed out while using, a failed
 * save, the connection): at most two, the most serious first. The save-failed banner is hidden
 * while offline: Try again can't work then, and the offline banner explains.
 */
export function BannerArea({ banners }: { banners: BannerSpec[] }) {
  const online = useOnline();
  const connection = useConnectionBanner(online);
  const save = useSaveStatus();
  const pathname = usePathname();
  const unsavedText = useSyncExternalStore(save.unsaved.subscribe, save.unsaved.any, noUnsavedOnServer);
  const shown = pickBanners([
    save.signedOut && signedOutBanner(loginHref(pathname), unsavedText),
    online && save.failed.size > 0 && SAVE_FAILED_BANNER,
    connection,
    ...banners,
  ]);
  if (shown.length === 0) return null;
  return (
    <div className="grid gap-2">
      {shown.map((b) =>
        b.id === "signed-out" ? (
          // Only ever shown after a refused save in the browser, so the query is read there.
          <Suspense key={b.id} fallback={<BannerFrom spec={b} />}>
            <SignedOutBanner spec={b} pathname={pathname} />
          </Suspense>
        ) : (
          <BannerFrom key={b.id} spec={b} />
        ),
      )}
    </div>
  );
}

function BannerFrom({ spec }: { spec: BannerSpec }) {
  return (
    <Banner tone={spec.tone} action={spec.action}>
      {spec.text}
    </Banner>
  );
}

/** "Sign in" returns to this page with its search and filter (?q=, ?status=). */
function SignedOutBanner({ spec, pathname }: { spec: BannerSpec; pathname: string }) {
  const query = useSearchParams().toString();
  const href = loginHref(query ? `${pathname}?${query}` : pathname);
  return <BannerFrom spec={{ ...spec, action: spec.action && { ...spec.action, href } }} />;
}
