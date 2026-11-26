// Which sections a user sees (M4-DESIGN 5 and 10.2). Pure, safe to import anywhere.
import { DEFAULT_SECTIONS, OWNER_SECTIONS, type SectionChoices } from "./access-types";

export interface StoredSections {
  reading: boolean;
  scaler: boolean;
  certs: boolean;
  projects: boolean;
  career: boolean;
  scalerUnlockedAt: Date | null;
}

export interface SectionSettings {
  /** What shows in the menu and on Home. Roadmap is always on. */
  sections: SectionChoices;
  /** Whether Scaler may be switched on: the access code was entered, or this is the owner. */
  scalerUnlocked: boolean;
}

/**
 * A user's sections: their stored choices, or the defaults when they have none (the owner's are
 * all on). Scaler only shows once it is unlocked; the owner always has it unlocked.
 */
export function effectiveSections(stored: StoredSections | null, isSuperAdmin: boolean): SectionSettings {
  const scalerUnlocked = isSuperAdmin || !!stored?.scalerUnlockedAt;
  const base = stored ? { roadmap: true, reading: stored.reading, scaler: stored.scaler, certs: stored.certs, projects: stored.projects, career: stored.career } : isSuperAdmin ? OWNER_SECTIONS : DEFAULT_SECTIONS;
  return { sections: { ...base, roadmap: true, scaler: base.scaler && scalerUnlocked }, scalerUnlocked };
}
