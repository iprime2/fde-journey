// /settings (design spec 5): sections, the Scaler access code, your data (download and Claude
// export keys) and deleting the account. Every active user. The content column is 640 px, left
// in the 960 px column: switch rows across 960 px would put each label far from its switch.
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { NoticeBanners, NoticeProvider } from "@/components/notices";
import { PageHeader } from "@/components/PageHeader";
import { DeleteAccountCard, ExportKeysCard, YourDataCard } from "@/components/settings/DataCards";
import { SectionSettings } from "@/components/settings/SectionSettings";
import { CardsSkeleton } from "@/components/Skeleton";
import { getMyExportKeys, getMySettings } from "@/lib/settings";
import { getNowMs } from "@/lib/today";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <NoticeProvider>
      <div className="grid w-full max-w-[640px] gap-5 lg:gap-6">
        <PageHeader title="Settings" description="Choose your sections, download your data or delete your account." />
        <NoticeBanners />
        <Suspense fallback={<CardsSkeleton cards={2} rows={4} />}>
          <SettingsContent />
        </Suspense>
      </div>
    </NoticeProvider>
  );
}

async function SettingsContent() {
  const [settings, keys, address] = await Promise.all([getMySettings(), getMyExportKeys(), exportAddress()]);
  const nowMs = await getNowMs();
  return (
    <>
      <SectionSettings initial={settings.sections} scalerUnlocked={settings.scalerUnlocked} />
      <YourDataCard />
      <ExportKeysCard initial={keys} nowMs={nowMs} address={address} />
      <DeleteAccountCard canDelete={settings.canDeleteAccount} githubLogin={settings.githubLogin} />
    </>
  );
}

/**
 * The Claude export endpoint's full address, shown on the export keys card: from BETTER_AUTH_URL
 * (the app's public address) when set, otherwise from the request's host.
 */
async function exportAddress(): Promise<string> {
  // Read the request first, so nothing here is worked out at build time.
  const h = await headers();
  const base = process.env.BETTER_AUTH_URL?.trim();
  if (base) {
    try {
      return new URL("/api/export", base).toString();
    } catch {
      // Falls back to the request's host.
    }
  }
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}/api/export`;
}
