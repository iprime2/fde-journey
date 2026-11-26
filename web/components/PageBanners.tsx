import { pageBanners } from "@/lib/banners";
import { READ_ONLY_PREVIEW } from "@/lib/mode";
import { BannerArea } from "./BannerArea";

/** The banner area of a section page (everything except Home). */
export function PageBanners() {
  return <BannerArea banners={pageBanners({ readOnly: READ_ONLY_PREVIEW, isHome: false, hasProgress: false })} />;
}
