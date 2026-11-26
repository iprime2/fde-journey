// Which sections show in the navigation and on Home (design spec 3.5 and 5). Pure functions, safe
// to import anywhere, client components included.
import type { SectionChoices, SwitchableSection } from "./access-types";

/**
 * The section pages, in today's tab order. Home is always first; Home, Roadmap and Courses have
 * no switch (always shown). Courses sits after Certifications, so the phone bar of the owner and
 * of new users (Home and their first three sections) stays as it was.
 */
export const NAV_HREFS = ["/", "/roadmap", "/reading", "/scaler", "/certs", "/courses", "/projects", "/career"] as const;
export type NavHref = (typeof NAV_HREFS)[number];

/** Always shown: no Settings switch and nothing stored. */
const ALWAYS_SHOWN: ReadonlySet<NavHref> = new Set(["/", "/roadmap", "/courses"]);

const SECTION_OF: Record<Exclude<NavHref, "/" | "/courses">, keyof SectionChoices> = {
  "/roadmap": "roadmap",
  "/reading": "reading",
  "/scaler": "scaler",
  "/certs": "certs",
  "/projects": "projects",
  "/career": "career",
};

/** Section names as Settings and the hidden-section banner say them. */
export const SECTION_LABELS: Record<keyof SectionChoices, string> = {
  roadmap: "Roadmap",
  reading: "Reading",
  scaler: "Scaler course",
  certs: "Certifications",
  projects: "Projects",
  career: "Career",
};

/** Shorter names for the first-visit sentence ("Want Scaler, Projects or Career too?"). */
const SHORT_LABELS: Record<SwitchableSection, string> = {
  reading: "Reading",
  scaler: "Scaler",
  certs: "Certifications",
  projects: "Projects",
  career: "Career",
};

/** Every section on: the owner's default, and what shows while the choices can't be read. */
export const ALL_SECTIONS: SectionChoices = { roadmap: true, reading: true, scaler: true, certs: true, projects: true, career: true };

/** Home plus the visible sections, in order. Roadmap and Courses are always visible. */
export function visibleHrefs(choices: SectionChoices): NavHref[] {
  return NAV_HREFS.filter((href) => ALWAYS_SHOWN.has(href) || choices[SECTION_OF[href as keyof typeof SECTION_OF]]);
}

/**
 * The phone layout: Home and the first three visible sections in the bar, the rest in the More
 * sheet (design spec 3.5).
 */
export function phoneSplit(choices: SectionChoices): { bar: NavHref[]; more: NavHref[] } {
  const visible = visibleHrefs(choices);
  return { bar: visible.slice(0, 4), more: visible.slice(4) };
}

/** The section (Settings switch) a page belongs to, or null for Home, Courses and other pages. */
export const sectionOfHref = (href: string): keyof SectionChoices | null =>
  Object.hasOwn(SECTION_OF, href) ? SECTION_OF[href as keyof typeof SECTION_OF] : null;

/** "A", "A or B", "A, B or C". */
export function orList(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

/**
 * The first-visit banner's extra sentence when any section is off (design spec 8): "Want Scaler,
 * Projects or Career too? Turn them on in" (then the Settings link). Null when every section is on.
 */
export function offSectionsPrompt(choices: SectionChoices): string | null {
  const off = (Object.keys(SHORT_LABELS) as SwitchableSection[]).filter((s) => !choices[s]).map((s) => SHORT_LABELS[s]);
  if (off.length === 0) return null;
  return `Want ${orList(off)} too? Turn ${off.length === 1 ? "it" : "them"} on in`;
}
