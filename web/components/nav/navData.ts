// What the navigation shows for the signed-in user (design spec 3.5): their visible sections and
// where the Admin link goes (null for no Admin link). Server-only; read inside <Suspense>.
import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { SectionChoices } from "@/lib/access-types";
import { type AdminHref, firstAdminHref } from "@/lib/admin-tabs";
import { ALL_SECTIONS, SECTION_LABELS } from "@/lib/nav";
import { describeError, rethrowNextControl } from "@/lib/safe-log";
import { getIdentity } from "@/lib/session";
import type { BannerSpec } from "@/lib/banners";
import { getMySettings } from "@/lib/settings";

export interface NavData {
  sections: SectionChoices;
  adminHref: AdminHref | null;
}

/**
 * Memoised per request (the sidebar, the bottom bar and the page share one read). Visitors who
 * aren't active never see the app (their page redirects); if the choices can't be read, every
 * section shows, so the navigation still works.
 */
export const getNavData = cache(async (): Promise<NavData> => {
  try {
    const me = await getIdentity();
    if (!me || me.status !== "active") return { sections: ALL_SECTIONS, adminHref: null };
    return { sections: await mySections(), adminHref: firstAdminHref(me.permissions) };
  } catch (error) {
    rethrowNextControl(error);
    console.error(`Navigation: reading sections failed (${describeError(error)})`);
    return { sections: ALL_SECTIONS, adminHref: null };
  }
});

/** The signed-in user's settings, read once per request. Redirects as requireUser() does. */
export const mySettings = cache(getMySettings);

/** The signed-in user's sections, read once per request. Redirects as requireUser() does. */
export const mySections = cache(async () => (await mySettings()).sections);

/**
 * A section page opened while it isn't in the user's menu (design spec 5 and 6, v0.6):
 * - switched off by the user themselves: the page works as usual, with the info banner returned
 *   here ("You've hidden Reading from your menu." and a link back to Settings);
 * - Scaler while it is locked (no access code; never the owner): the not-found page. Its saves are
 *   refused on the server too (app/actions/progress.ts).
 * Null when the section is on. Roadmap is never hidden.
 */
export async function hiddenSectionBanner(section: Exclude<keyof SectionChoices, "roadmap">): Promise<BannerSpec | null> {
  const settings = await mySettings();
  if (section === "scaler" && !settings.scalerUnlocked) notFound();
  if (settings.sections[section]) return null;
  return {
    id: "hidden-section",
    tone: "info",
    text: `You've hidden ${SECTION_LABELS[section]} from your menu.`,
    action: { label: "Turn it back on in Settings", href: "/settings" },
  };
}
