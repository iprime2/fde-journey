// The app's sections, in today's tab order (design spec 3.2).
import type { SectionKey } from "@/lib/summary";
import {
  AwardIcon,
  BadgeCheckIcon,
  BookOpenIcon,
  BriefcaseIcon,
  ChartColumnIcon,
  FolderGitIcon,
  GraduationCapIcon,
  HouseIcon,
  MapIcon,
  SettingsIcon,
  ShieldIcon,
} from "../icons";
import { isAdminPath } from "@/lib/admin-tabs";
import type { NavHref } from "@/lib/nav";

export type SectionHref = NavHref;

export interface Section {
  href: SectionHref;
  label: string;
  /** Bottom-bar label, when shorter. */
  shortLabel?: string;
  /** Key for the count beside it; Home has none. */
  countKey?: SectionKey;
  Icon: (p: { size?: number; className?: string }) => React.ReactNode;
}

export const SECTIONS: readonly Section[] = [
  { href: "/", label: "Home", Icon: HouseIcon },
  { href: "/roadmap", label: "Roadmap", countKey: "roadmap", Icon: MapIcon },
  { href: "/reading", label: "Reading", countKey: "reading", Icon: BookOpenIcon },
  { href: "/scaler", label: "Scaler course", shortLabel: "Scaler", countKey: "scaler", Icon: GraduationCapIcon },
  { href: "/certs", label: "Certifications", countKey: "certs", Icon: AwardIcon },
  { href: "/courses", label: "Courses", countKey: "courses", Icon: BadgeCheckIcon },
  { href: "/projects", label: "Projects", countKey: "projects", Icon: FolderGitIcon },
  { href: "/career", label: "Career", countKey: "career", Icon: BriefcaseIcon },
];

/** Whether `pathname` is the section at `href`. */
export const isCurrentSection = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/**
 * Insights (design spec 10.7): always shown, no count, and not a section, so it never takes a
 * bottom-bar cell. Right after Home in the sidebar; the first row of the More sheet on phones.
 */
export const INSIGHTS_HREF = "/insights";
export const INSIGHTS_ITEM = { label: "Insights", Icon: ChartColumnIcon } as const;

/** The second group (design spec 3.5): Settings for everyone, Admin for admins only. */
export const SETTINGS_ITEM = { label: "Settings", Icon: SettingsIcon } as const;
export const ADMIN_ITEM = { label: "Admin", Icon: ShieldIcon } as const;
/** Links that aren't sections: Insights, Settings and Admin. */
export type ExtraItem = "insights" | "settings" | "admin";

export const EXTRA_ITEMS: Record<ExtraItem, { label: string; Icon: Section["Icon"] }> = {
  insights: INSIGHTS_ITEM,
  settings: SETTINGS_ITEM,
  admin: ADMIN_ITEM,
};

const underPath = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** Whether `pathname` belongs to Insights, Settings or any admin page. */
export const isCurrentExtra = (pathname: string, item: ExtraItem) =>
  item === "insights" ? underPath(pathname, INSIGHTS_HREF) : item === "settings" ? underPath(pathname, "/settings") : isAdminPath(pathname);

export const sectionFor = (href: string) => SECTIONS.find((s) => s.href === href);
