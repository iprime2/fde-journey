// Shapes of the public roadmap content. Personal progress never lives here; it is stored
// per item id (see lib/ids.ts) in the database from milestone M2.

/** A roadmap task: [title, tag]. */
export type PhaseTask = [title: string, tag: string];

export interface Phase {
  n: number;
  title: string;
  /** ISO date, inclusive. */
  start: string;
  /** ISO date, inclusive. */
  end: string;
  tasks: PhaseTask[];
}

export interface Cert {
  name: string;
  /** Display order only. Ids follow the array position, never the rank. */
  rank?: number;
  priority: string;
  date: string;
  desc: string;
  status: string;
  tasks: string[];
}

export interface Project {
  name: string;
  subtitle: string;
  desc: string;
  tasks: string[];
}

export interface CareerItem {
  title: string;
  date: string;
  desc: string;
}

export interface ScalerModule {
  n: number;
  title: string;
  sub: string;
  months: number;
  kind: "core" | "elective";
  classes: string[];
}

export type ResourceType = "video" | "article" | "docs" | "course" | "interactive";

export interface Resource {
  title: string;
  url: string;
  by: string;
  type: ResourceType;
  length: string;
  level: "beginner" | "intermediate";
  why: string;
}

export interface ResourceGroup {
  /** Short "start here" advice for the task. */
  start: string;
  items: Resource[];
}

export interface Paper {
  /** ISO date of the Monday of the reading week. */
  week: string;
  core: boolean;
  title: string;
  url: string;
  by: string;
  why: string;
}

export interface Book {
  core: boolean;
  title: string;
  by: string;
  url: string;
  why: string;
}

export interface TrackerContent {
  phases: Phase[];
  certs: Cert[];
  projects: Project[];
  career: CareerItem[];
  scaler: ScalerModule[];
  /** Keyed by roadmap task id, e.g. "l1-1". */
  resources: Record<string, ResourceGroup>;
  papers: Paper[];
  books: Book[];
}
