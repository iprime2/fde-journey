// Fixed facts from the tracker's page header (tracker/fde-journey-tracker.html). They are not part of
// the generated content file, so keep them in step with the tracker by hand.

/** Scaler classes: Monday, Wednesday and Friday, 09:00 to 11:30 India Standard Time. */
export const CLASS_SCHEDULE = {
  /** 0 = Sunday ... 6 = Saturday. */
  weekdays: [1, 3, 5],
  startMinutes: 9 * 60,
  endMinutes: 11 * 60 + 30,
} as const;

export const CLASS_SCHEDULE_LABEL = "Mon · Wed · Fri, 09:00–11:30 IST";

/** The February readiness review: a portfolio and job-readiness milestone. ISO date. */
export const READINESS_REVIEW = "2027-02-15";
