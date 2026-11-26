// Status chips and "where am I now" rules, the same as the tracker's. Pure functions.

/**
 * Filled variants are statuses; `tag` (outlined) is an attribute that isn't a status, such as
 * "Badge" on Courses & badges (design spec 4, StatusChip, v0.7).
 */
export type ChipVariant = "neutral" | "ok" | "now" | "warn" | "danger" | "tag";

export interface ChipState {
  label: string;
  variant: ChipVariant;
}

interface DateRange {
  start: string;
  end: string;
}

/** Complete / This phase / Behind / Upcoming. */
export function phaseChip(phase: DateRange, todayIso: string, done: number, total: number): ChipState {
  if (done === total) return { label: "Complete", variant: "ok" };
  if (todayIso >= phase.start && todayIso <= phase.end) return { label: "This phase", variant: "now" };
  if (todayIso > phase.end) return { label: "Behind", variant: "warn" };
  return { label: "Upcoming", variant: "neutral" };
}

/** Complete / Current / In progress / Not started. */
export function moduleChip(done: number, total: number, isCurrent: boolean): ChipState {
  if (done === total) return { label: "Complete", variant: "ok" };
  if (isCurrent) return { label: "Current", variant: "now" };
  return { label: done > 0 ? "In progress" : "Not started", variant: "neutral" };
}

/** "Passed" once the last step is ticked; otherwise the certification's priority. */
export function certChip(priority: string, passed: boolean): ChipState {
  return passed ? { label: "Passed", variant: "ok" } : { label: priority, variant: "neutral" };
}

/** Complete / In progress / Not started. */
export function projectChip(done: number, total: number): ChipState {
  if (done === total) return { label: "Complete", variant: "ok" };
  return { label: done > 0 ? "In progress" : "Not started", variant: "neutral" };
}

/**
 * The phase whose dates include today. Before the journey starts: the first phase. After a gap
 * or the end: the first phase not yet complete, else the last one.
 */
export function pickCurrentPhase<P extends DateRange>(phases: readonly P[], todayIso: string, isComplete: (p: P) => boolean): P {
  return (
    phases.find((p) => todayIso >= p.start && todayIso <= p.end) ??
    (todayIso < phases[0].start ? phases[0] : (phases.find((p) => !isComplete(p)) ?? phases[phases.length - 1]))
  );
}

/** The first module with a class not yet done, else the last module. */
export function pickCurrentModule<M>(modules: readonly M[], isComplete: (m: M) => boolean): M {
  return modules.find((m) => !isComplete(m)) ?? modules[modules.length - 1];
}
