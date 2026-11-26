// What the navigation shows for the signed-in user (design spec 3.5): their visible sections and
// where the Admin link goes (null for no Admin link). Server-only; read inside <Suspense>.
import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { SectionChoices } from "@/lib/access-types";
import { type AdminHref, firstAdminHref } from "@/lib/admin-tabs";
import { ALL_SECTIONS } from "@/lib/nav";
import { describeError, rethrowNextControl } from "@/lib/safe-log";
import { getIdentity } from "@/lib/session";
import { getMySections } from "@/lib/settings";

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

/** The signed-in user's sections, read once per request. Redirects as requireUser() does. */
export const mySections = cache(getMySections);

/**
 * Hidden sections are refused on the server, not only left out of the navigation: a section page
 * shows the not-found page while that section is off for the user, and /scaler also while Scaler
 * is locked (getMySections never reports a locked Scaler as on). Roadmap is never hidden.
 */
export async function requireSection(section: Exclude<keyof SectionChoices, "roadmap">): Promise<void> {
  const sections = await mySections();
  if (!sections[section]) notFound();
}
