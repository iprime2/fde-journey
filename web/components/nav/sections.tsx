// The app's sections, in today's tab order (design spec 3.2).
import type { SectionKey } from "@/lib/summary";
import {
  AwardIcon,
  BookOpenIcon,
  BriefcaseIcon,
  FolderGitIcon,
  GraduationCapIcon,
  HouseIcon,
  MapIcon,
} from "../icons";

export type SectionHref = "/" | "/roadmap" | "/reading" | "/scaler" | "/certs" | "/projects" | "/career";

export interface Section {
  href: SectionHref;
  label: string;
  /** Bottom-bar label, when shorter. */
  shortLabel?: string;
  /** Key for the count beside it; Home has none. */
  countKey?: SectionKey;
  Icon: (p: { size?: number; className?: string }) => React.ReactNode;
  /** On phones: in the bottom bar, or in the More sheet. */
  phone: "bar" | "more";
}

export const SECTIONS: readonly Section[] = [
  { href: "/", label: "Home", Icon: HouseIcon, phone: "bar" },
  { href: "/roadmap", label: "Roadmap", countKey: "roadmap", Icon: MapIcon, phone: "bar" },
  { href: "/reading", label: "Reading", countKey: "reading", Icon: BookOpenIcon, phone: "bar" },
  { href: "/scaler", label: "Scaler course", shortLabel: "Scaler", countKey: "scaler", Icon: GraduationCapIcon, phone: "bar" },
  { href: "/certs", label: "Certifications", countKey: "certs", Icon: AwardIcon, phone: "more" },
  { href: "/projects", label: "Projects", countKey: "projects", Icon: FolderGitIcon, phone: "more" },
  { href: "/career", label: "Career", countKey: "career", Icon: BriefcaseIcon, phone: "more" },
];

/** Whether `pathname` is the section at `href`. */
export const isCurrentSection = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
