// Names shared by the database schema, the server code and the front end (M4b): user statuses,
// admin permissions, audit actions and the sections a user can show or hide. Pure constants, safe
// to import anywhere, client components included.

/** A user's access. Existing users were active; new sign-ups in capped mode start waitlisted. */
export const USER_STATUSES = ["active", "waitlisted", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/**
 * Admin permissions (M4-DESIGN 6), in the order the Admins page lists them. The super admin (the
 * GitHub account OWNER_GITHUB_ID) holds all of them in code, never as rows, and can't lose them.
 */
export const PERMISSIONS = ["metrics.view", "users.view", "users.manage", "waitlist.manage", "settings.manage", "audit.view", "admins.manage"] as const;
export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value);
}

/** Granting this one implies "users.view" (design spec 5, Admins: "Needed to suspend and reactivate users."). */
export const IMPLIED_PERMISSIONS: Partial<Record<Permission, Permission>> = { "users.manage": "users.view" };

/** Permissions in the order above, without duplicates. */
export const sortPermissions = (list: readonly Permission[]): Permission[] => [...new Set(list)].sort((a, b) => PERMISSIONS.indexOf(a) - PERMISSIONS.indexOf(b));

/** A set as saved: duplicates removed, implied permissions added (users.manage needs users.view). */
export function withImpliedPermissions(list: readonly Permission[]): Permission[] {
  const out = new Set(list);
  for (const p of list) {
    const implied = IMPLIED_PERMISSIONS[p];
    if (implied) out.add(implied);
  }
  return sortPermissions([...out]);
}

/** Only the super admin can grant or take away this permission. */
export const SUPER_ADMIN_ONLY: Permission = "admins.manage";

/** What the audit log records. Details hold counts and permission names only. */
export const AUDIT_ACTIONS = [
  "let_in",
  "let_in_many",
  "waitlist_removed",
  "suspended",
  "reactivated",
  "reactivated_to_waitlist",
  "cap_changed",
  "admin_added",
  "permissions_changed",
  "admin_removed",
  "scaler_code_set",
  "scaler_code_failed",
  "account_deleted",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Actions that name a person. When such a row has no target, that person has deleted their account. */
export const TARGETED_AUDIT_ACTIONS: ReadonlySet<AuditAction> = new Set([
  "let_in",
  "waitlist_removed",
  "suspended",
  "reactivated",
  "reactivated_to_waitlist",
  "admin_added",
  "permissions_changed",
  "admin_removed",
]);

/** The audit log's "Show" filter (design spec 5, Audit log), as `?action=` values. */
export const AUDIT_FILTERS = {
  "let-in": ["let_in", "let_in_many"],
  "removed-from-waitlist": ["waitlist_removed"],
  suspended: ["suspended"],
  reactivated: ["reactivated", "reactivated_to_waitlist"],
  "cap-changed": ["cap_changed"],
  "permissions-changed": ["admin_added", "permissions_changed", "admin_removed"],
  "scaler-code": ["scaler_code_set", "scaler_code_failed"],
  "accounts-deleted": ["account_deleted"],
} as const satisfies Record<string, readonly AuditAction[]>;
export type AuditFilter = keyof typeof AUDIT_FILTERS;

/** Sections a user can show or hide. Roadmap is always on and has no switch. */
export const SECTIONS = ["roadmap", "reading", "scaler", "certs", "projects", "career"] as const;
export type Section = (typeof SECTIONS)[number];
export type SwitchableSection = Exclude<Section, "roadmap">;
export const SWITCHABLE_SECTIONS: readonly SwitchableSection[] = ["reading", "scaler", "certs", "projects", "career"];
export type SectionChoices = Record<Section, boolean>;

/** New users (M4-DESIGN 5): Roadmap, Reading and Certifications on; Scaler, Projects and Career off. */
export const DEFAULT_SECTIONS: SectionChoices = { roadmap: true, reading: true, scaler: false, certs: true, projects: false, career: false };
/** The owner keeps all six. */
export const OWNER_SECTIONS: SectionChoices = { roadmap: true, reading: true, scaler: true, certs: true, projects: true, career: true };

/** Wrong Scaler access codes a user may try per hour (M4-DESIGN 10.2). */
export const SCALER_TRIES_PER_HOUR = 5;

/** The user cap's limits (M4-DESIGN 10.4). */
export const USER_CAP_MIN = 0;
export const USER_CAP_MAX = 1000;

/** Rows per page on the admin lists (design spec 4, DataTable: "Show 50 more"). */
export const ADMIN_PAGE_SIZE = 50;

/** Done counts by section on the admin Users list. Every item id belongs to exactly one. */
export const DONE_SECTIONS = ["roadmap", "resources", "reading", "scaler", "certs", "projects", "career"] as const;
export type DoneSection = (typeof DONE_SECTIONS)[number];
