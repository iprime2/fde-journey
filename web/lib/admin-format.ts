// Wording and small rules for the admin pages, Settings and the waitlist (design spec 5 and 8).
// Pure functions, safe to import anywhere. Dates are worked out in IST, like the rest of the app.
import { type AuditAction, type DoneSection, DONE_SECTIONS, PERMISSIONS, type Permission } from "./access-types";
import { formatDate, formatDayMonth, istClock, istDate } from "./dates";

const pad = (n: number) => String(n).padStart(2, "0");

/** "1,000" */
export const formatCount = (n: number) => n.toLocaleString("en-GB");

/** "1 person" / "5 people" */
export const people = (n: number) => `${formatCount(n)} ${n === 1 ? "person" : "people"}`;

/** "30 Nov 2026" for an instant, in IST. */
export const formatIstDate = (iso: string) => formatDate(istDate(Date.parse(iso)));

/** "30 Nov 2026, 14:05 IST" */
export function formatIstDateTime(iso: string): string {
  const clock = istClock(Date.parse(iso));
  return `${formatDate(clock.date)}, ${pad(Math.floor(clock.minutes / 60))}:${pad(clock.minutes % 60)} IST`;
}

/** "Today", "Yesterday", "3 Dec" (this year), "3 Dec 2025", or "Never" (design spec 5, Users). */
export function lastActiveLabel(iso: string | null, nowMs: number): string {
  if (!iso) return "Never";
  const day = istDate(Date.parse(iso));
  const today = istDate(nowMs);
  if (day === today) return "Today";
  if (day === istDate(nowMs - 86_400_000)) return "Yesterday";
  return day.slice(0, 4) === today.slice(0, 4) ? formatDayMonth(day) : formatDate(day);
}

const DONE_LABELS: Record<DoneSection, string> = {
  roadmap: "Roadmap",
  resources: "Resources",
  reading: "Reading",
  scaler: "Scaler",
  certs: "Certifications",
  projects: "Projects",
  career: "Career",
};

/** "Roadmap 12 · Resources 30 · Reading 3", listing only sections with at least one; "Nothing yet". */
export function doneLine(done: Record<DoneSection, number>): string {
  const parts = DONE_SECTIONS.filter((s) => done[s] > 0).map((s) => `${DONE_LABELS[s]} ${formatCount(done[s])}`);
  return parts.length > 0 ? parts.join(" · ") : "Nothing yet";
}

/** The waitlist page's line under the place: "11 people are ahead of you." / "You're next." */
export function aheadLine(place: number): string {
  const ahead = Math.max(0, place - 1);
  if (ahead === 0) return "You're next.";
  return `${people(ahead)} ${ahead === 1 ? "is" : "are"} ahead of you.`;
}

/** A whole number typed in a field, within [min, max]; null for anything else ("", "1.5", "-2", "1e3"). */
export function parseWholeNumber(value: string, min: number, max: number): number | null {
  const text = value.trim();
  if (!/^\d{1,7}$/.test(text)) return null;
  const n = Number(text);
  return n >= min && n <= max ? n : null;
}

// ---- Waitlist: letting people in

/** The most that "Let them in" may ask for: the smaller of free places and people waiting. */
export const letInMax = (free: number, waiting: number) => Math.max(0, Math.min(free, waiting));
/** The field's starting value: the smaller of 5 and the maximum. */
export const letInDefault = (free: number, waiting: number) => Math.min(5, letInMax(free, waiting));

/** "5 people were let in." / "1 person was let in." / "Nobody was let in." */
export function letInResult(admitted: number): string {
  if (admitted === 0) return "Nobody was let in. The waitlist or the places changed; reload the page.";
  return `${people(admitted)} ${admitted === 1 ? "was" : "were"} let in.`;
}

// ---- Sign-up: the cap

export type CapChange = { kind: "raise"; admits: number } | { kind: "lower" } | { kind: "plain" };

/**
 * Which confirmation a new cap needs (design spec 5, Sign-up). Raising it while people wait lets
 * some in (a Dialog says how many); lowering it below the places already taken asks too; anything
 * else just saves.
 */
export function capChange(current: number, next: number, taken: number, waiting: number): CapChange {
  if (next > current) {
    const admits = Math.min(Math.max(0, next - taken), waiting);
    return admits > 0 ? { kind: "raise", admits } : { kind: "plain" };
  }
  if (next < current && next < taken) return { kind: "lower" };
  return { kind: "plain" };
}

/** "Cap saved: 120 places." / "Cap saved: 120 places. 7 people were let in." */
export function capSavedMessage(cap: number, admitted: number): string {
  const saved = `Cap saved: ${formatCount(cap)} ${cap === 1 ? "place" : "places"}.`;
  return admitted > 0 ? `${saved} ${letInResult(admitted)}` : saved;
}

// ---- Admins: permissions

export const PERMISSION_COPY: Record<Permission, { label: string; description: string }> = {
  "metrics.view": { label: "See the overview", description: "Numbers of places, sign-ups and activity." },
  "users.view": { label: "See users", description: "Names, usernames, status, dates and done counts." },
  "users.manage": { label: "Suspend and reactivate users", description: "Stop someone signing in, or let them back." },
  "waitlist.manage": { label: "Manage the waitlist", description: "Let people in or remove them from the queue." },
  "settings.manage": { label: "Change the user cap", description: "Set how many people can have a place." },
  "audit.view": { label: "See the audit log", description: "Every admin action, newest first." },
  "admins.manage": { label: "Manage admins", description: "Make people admins and change their permissions." },
};

/** Shown under "See users" while "Suspend and reactivate users" is ticked. */
export const IMPLIED_DESCRIPTION = "Needed to suspend and reactivate users.";

const inOrder = (list: Iterable<Permission>) => PERMISSIONS.filter((p) => new Set(list).has(p));

/** "See users, Manage the waitlist" */
export const permissionLabels = (list: Iterable<Permission>) => inOrder(list).map((p) => PERMISSION_COPY[p].label).join(", ");

/** What changes between two permission sets, each in the order of PERMISSIONS. */
export function permissionDiff(before: readonly Permission[], after: readonly Permission[]): { give: Permission[]; take: Permission[] } {
  return { give: inOrder(after).filter((p) => !before.includes(p)), take: inOrder(before).filter((p) => !after.includes(p)) };
}

/** "Give: See users, Manage the waitlist. Take away: See the audit log." (an empty part is left out) */
export function permissionDiffText(before: readonly Permission[], after: readonly Permission[]): string {
  const { give, take } = permissionDiff(before, after);
  return [give.length > 0 && `Give: ${permissionLabels(give)}.`, take.length > 0 && `Take away: ${permissionLabels(take)}.`].filter(Boolean).join(" ");
}

// ---- Audit log

/** A sentence, with GitHub usernames kept apart so they can be set without line breaks. */
export type SentencePart = string | { login: string };

interface AuditInput {
  action: AuditAction;
  target: { githubLogin: string | null; name: string } | null;
  targetDeleted: boolean;
  details: Record<string, unknown>;
}

const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null);
const permissionList = (value: unknown): Permission[] =>
  Array.isArray(value) ? inOrder(value.filter((v): v is Permission => typeof v === "string" && (PERMISSIONS as readonly string[]).includes(v))) : [];

/** The person an action names: "@sam-example", their name without a username, or "a deleted account". */
function who(entry: AuditInput): SentencePart {
  if (!entry.target) return "a deleted account";
  return entry.target.githubLogin ? { login: entry.target.githubLogin } : entry.target.name;
}

/** One plain sentence per admin action (design spec 8, Audit log). Never a note, link or email. */
export function auditSentence(entry: AuditInput): SentencePart[] {
  const d = entry.details;
  switch (entry.action) {
    case "let_in":
      return ["Let in ", who(entry), "."];
    case "let_in_many": {
      const n = num(d.count) ?? 0;
      return [`Let in ${people(n)} from the waitlist.`];
    }
    case "waitlist_removed":
      return ["Removed ", who(entry), " from the waitlist."];
    case "suspended":
      return ["Suspended ", who(entry), "."];
    case "reactivated":
      return ["Reactivated ", who(entry), "."];
    case "reactivated_to_waitlist":
      return ["Reactivated ", who(entry), ". No place was free, so they joined the waitlist."];
    case "cap_changed": {
      const from = num(d.from);
      const to = num(d.to);
      const admitted = num(d.admitted) ?? 0;
      const change = from === null ? `Set the cap to ${formatCount(to ?? 0)}` : `Changed the cap from ${formatCount(from)} to ${formatCount(to ?? 0)}`;
      return [admitted > 0 ? `${change} and let in ${people(admitted)}.` : `${change}.`];
    }
    case "admin_added":
      return ["Made ", who(entry), ` an admin: ${permissionLabels(permissionList(d.gave)) || "no permissions"}.`];
    case "permissions_changed": {
      const gave = permissionList(d.gave);
      const took = permissionList(d.took);
      const parts = [gave.length > 0 && ` Gave: ${permissionLabels(gave)}.`, took.length > 0 && ` Took away: ${permissionLabels(took)}.`].filter(Boolean).join("");
      return ["Changed ", who(entry), `'s permissions.${parts}`];
    }
    case "admin_removed":
      return ["Removed ", who(entry), " as an admin."];
    case "scaler_code_set":
      return ["Set a new Scaler access code."];
    case "scaler_code_failed": {
      const n = num(d.tryInHour);
      return [n ? `Entered a wrong Scaler access code (try ${n} this hour).` : "Entered a wrong Scaler access code."];
    }
    case "account_deleted":
      return [d.status === "waitlisted" ? "Left the waitlist, which deleted their account." : "Deleted their own account."];
    default:
      return ["Made a change."];
  }
}

/** The sentence as plain text ("Suspended @sam-example."). */
export const sentenceText = (parts: readonly SentencePart[]) => parts.map((p) => (typeof p === "string" ? p : `@${p.login}`)).join("");
