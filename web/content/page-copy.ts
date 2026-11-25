// Page descriptions from the design spec (section 5). Hand-written: a unit test checks that the
// counts they mention still match the content.

export const ROADMAP_DESCRIPTION =
  "Eight phases from 24 Nov 2026 to 15 Feb 2027. Learning resources are tracked separately from roadmap progress.";

export const READING_DESCRIPTION = "One core paper a week, plus books. Tracked separately from roadmap progress.";

export const SCALER_DESCRIPTION = "14 modules: 10 core and 4 electives.";

export const CERTS_DESCRIPTION =
  "In the order to take them. A certification counts as passed when its last step is ticked.";

export const PROJECTS_DESCRIPTION = "Three portfolio projects. A project is complete when every step is ticked.";

export const SEARCH_PLACEHOLDERS = {
  roadmap: "Search tasks, resources, notes…",
  reading: "Search papers, books, notes…",
  scaler: "Search classes and notes…",
  certs: "Search steps and notes…",
  projects: "Search steps and notes…",
  career: "Search milestones and notes…",
} as const;
