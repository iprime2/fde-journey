import type { BannerTone } from "@/lib/banners";
import { cn } from "./cn";

const TONE_STYLES: Record<BannerTone, string> = {
  info: "bg-sunk text-ink",
  warning: "bg-warn-soft text-warn",
  error: "bg-danger-soft text-danger",
};

/** Full-width message strip. Errors use role="alert"; the others role="status". */
export function Banner({ tone, children }: { tone: BannerTone; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("type-small rounded-md px-3.5 py-2.5 [overflow-wrap:anywhere]", TONE_STYLES[tone])}
    >
      {children}
    </div>
  );
}
