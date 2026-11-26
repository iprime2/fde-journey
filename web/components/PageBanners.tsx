import { Suspense } from "react";
import { pageBanners } from "@/lib/banners";
import { isReadOnly } from "@/lib/mode";
import { BannerArea } from "./BannerArea";

/**
 * The banner area of a section page (everything except Home). The read-only check reads the
 * session, so it streams in behind its own boundary; until then only the connection banner shows.
 */
export function PageBanners() {
  return (
    <Suspense fallback={<BannerArea banners={[]} />}>
      <SessionBanners />
    </Suspense>
  );
}

async function SessionBanners() {
  return <BannerArea banners={pageBanners({ readOnly: await isReadOnly(), isHome: false, hasProgress: false })} />;
}
