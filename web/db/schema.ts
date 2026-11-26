// Database schema (Drizzle, Postgres). Migrations are generated from this file with
// `npm run db:generate` and committed in db/migrations/. Never edit a merged migration.
import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
// Relative, not "@/": drizzle-kit reads this file too.
import { AUDIT_ACTIONS, PERMISSIONS, USER_STATUSES } from "../lib/access-types";

const tz = { withTimezone: true, mode: "date" } as const;

/**
 * Saved progress, one row per user and item id (lib/ids.ts), same fields as the tracker's records.
 * Every query on this table filters on `user_id` (lib/progress-db.ts; tests/unit/isolation-guard.test.ts).
 */
export const progress = pgTable(
  "progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    done: boolean("done").notNull().default(false),
    note: text("note").notNull().default(""),
    link: text("link").notNull().default(""),
    doneAt: timestamp("done_at", tz),
    updatedAt: timestamp("updated_at", tz).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.itemId] }),
    // Defence in depth: the server validates first, these only stop bad rows from any other path.
    check("progress_note_length", sql`char_length(${t.note}) <= 10000`),
    check("progress_link_length", sql`char_length(${t.link}) <= 2000`),
    check("progress_link_https", sql`${t.link} = '' OR ${t.link} ~* '^https://'`),
    check("progress_done_at", sql`${t.done} OR ${t.doneAt} IS NULL`),
  ],
);

/** What a save changed. One row per change, written in the same statement as the change itself. */
export const PROGRESS_EVENT_KINDS = ["done", "undone", "note", "link"] as const;
export type ProgressEventKind = (typeof PROGRESS_EVENT_KINDS)[number];

/**
 * The history of saves, for the insights dashboard (M5). It records only that something changed,
 * never the note or link text: there is deliberately no column that could hold it.
 */
export const progressEvent = pgTable(
  "progress_event",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    kind: text("kind", { enum: PROGRESS_EVENT_KINDS }).notNull(),
    at: timestamp("at", tz).notNull().defaultNow(),
  },
  (t) => [
    index("progress_event_user_at_idx").on(t.userId, t.at),
    check("progress_event_kind", sql`${t.kind} IN ('done', 'undone', 'note', 'link')`),
    check("progress_event_item_id_length", sql`char_length(${t.itemId}) <= 64`),
  ],
);

// ---- Better Auth tables (Drizzle adapter). Field names follow Better Auth's generated schema.

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", tz)
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    // ---- M4b (lib/auth.ts declares these to Better Auth as additional fields)
    /** The GitHub username, refreshed at every sign-in. Null until the next sign-in for older users. */
    githubLogin: text("github_login"),
    status: text("status", { enum: USER_STATUSES }).notNull().default("active"),
    /** When the user last got a place. */
    activatedAt: timestamp("activated_at", tz),
    /** When the user last joined the waitlist: the queue's order. */
    waitlistedAt: timestamp("waitlisted_at", tz),
    /** Last sign-in or save, written at most once an hour (lib/activity.ts). */
    lastActiveAt: timestamp("last_active_at", tz),
  },
  (t) => [
    check("user_status", sql`${t.status} IN ('active', 'waitlisted', 'suspended')`),
    check("user_github_login", sql`${t.githubLogin} IS NULL OR ${t.githubLogin} ~ '^[A-Za-z0-9-]{1,39}$'`),
    index("user_status_waitlisted_idx").on(t.status, t.waitlistedAt),
    index("user_github_login_idx").on(sql`lower(${t.githubLogin})`),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", tz).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", tz)
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_userId_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    /** For GitHub: the numeric GitHub user id, as text. The owner check compares this. */
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", tz),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", tz),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", tz)
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("account_userId_idx").on(t.userId),
    // One GitHub account can belong to one user only.
    uniqueIndex("account_provider_account_idx").on(t.providerId, t.accountId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", tz).notNull(),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", tz)
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("verification_identifier_idx").on(t.identifier),
    // Expired rows (old sign-in attempts) are deleted with one indexed query before each new one.
    index("verification_expiresAt_idx").on(t.expiresAt),
  ],
);

// ---- M4b: permissions, settings, audit, per-user settings and export keys

export const userPermission = pgTable(
  "user_permission",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    permission: text("permission", { enum: PERMISSIONS }).notNull(),
    grantedBy: text("granted_by").references(() => user.id, { onDelete: "set null" }),
    grantedAt: timestamp("granted_at", tz).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.permission] }),
    check(
      "user_permission_permission",
      sql`${t.permission} IN ('metrics.view', 'users.view', 'users.manage', 'waitlist.manage', 'settings.manage', 'admins.manage', 'audit.view')`,
    ),
  ],
);

/**
 * App-wide settings, changed from the admin pages. Keys: `user_cap` (0 to 1,000, seeded 100) and
 * `scaler_code_hash` (the Scaler access code, scrypt hash only; lib/access-code.ts).
 */
export const appSetting = pgTable(
  "app_setting",
  {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", tz).notNull().defaultNow(),
  },
  (t) => [
    check("app_setting_key", sql`${t.key} IN ('user_cap', 'scaler_code_hash')`),
    // Nested CASE, so the cast only runs on digits (AND and OR don't promise an order).
    check(
      "app_setting_user_cap",
      sql`CASE WHEN ${t.key} <> 'user_cap' THEN true WHEN ${t.value} !~ '^[0-9]{1,4}$' THEN false ELSE ${t.value}::int <= 1000 END`,
    ),
    check("app_setting_value_length", sql`char_length(${t.value}) <= 512`),
  ],
);


/**
 * Who did what to whom, and when. `details` holds counts and non-personal fields only (permission
 * names, cap numbers), never note text, links, emails or codes. A deleted user's rows keep their
 * place with the user set to null: the log then shows "a deleted account".
 */
export const adminAudit = pgTable(
  "admin_audit",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action", { enum: AUDIT_ACTIONS }).notNull(),
    targetUserId: text("target_user_id").references(() => user.id, { onDelete: "set null" }),
    details: jsonb("details").notNull().default({}),
    at: timestamp("at", tz).notNull().defaultNow(),
  },
  (t) => [
    index("admin_audit_at_idx").on(t.at),
    index("admin_audit_action_at_idx").on(t.action, t.at),
    check(
      "admin_audit_action",
      sql`${t.action} IN ('let_in', 'let_in_many', 'waitlist_removed', 'suspended', 'reactivated', 'reactivated_to_waitlist', 'cap_changed', 'admin_added', 'permissions_changed', 'admin_removed', 'scaler_code_set', 'scaler_code_failed', 'account_deleted')`,
    ),
    check("admin_audit_details_object", sql`jsonb_typeof(${t.details}) = 'object'`),
  ],
);

/**
 * One row per user: which sections show, and the Scaler unlock. Roadmap is always on (no column).
 * Users without a row get the defaults (lib/settings.ts). Per-user: every query filters on user_id.
 */
export const userSettings = pgTable(
  "user_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    showReading: boolean("show_reading").notNull().default(true),
    showScaler: boolean("show_scaler").notNull().default(false),
    showCerts: boolean("show_certs").notNull().default(true),
    showProjects: boolean("show_projects").notNull().default(false),
    showCareer: boolean("show_career").notNull().default(false),
    /** Set once the user entered the Scaler access code (the owner's row is set by migration 0003). */
    scalerUnlockedAt: timestamp("scaler_unlocked_at", tz),
    /** Access-code tries in the current hour-long window (rate limit, lib/settings-db.ts). */
    scalerAttempts: integer("scaler_attempts").notNull().default(0),
    scalerAttemptsSince: timestamp("scaler_attempts_since", tz),
    updatedAt: timestamp("updated_at", tz).notNull().defaultNow(),
  },
  (t) => [
    check("user_settings_scaler_unlocked", sql`NOT ${t.showScaler} OR ${t.scalerUnlockedAt} IS NOT NULL`),
    check("user_settings_scaler_attempts", sql`${t.scalerAttempts} >= 0`),
  ],
);

/**
 * Keys for the Claude export (`/api/export`). The key is shown once; only its SHA-256 hash is kept.
 * Per-user: every query filters on user_id, except the reviewed lookup by hash (lib/export-auth.ts).
 */
export const exportToken = pgTable(
  "export_token",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", tz),
    revokedAt: timestamp("revoked_at", tz),
    /** Requests in the current hour-long window (rate limit). */
    windowStart: timestamp("window_start", tz),
    windowCount: integer("window_count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("export_token_hash_idx").on(t.tokenHash),
    index("export_token_user_idx").on(t.userId),
    check("export_token_hash_format", sql`${t.tokenHash} ~ '^[0-9a-f]{64}$'`),
  ],
);

/** The tables Better Auth's Drizzle adapter needs, keyed by its model names. */
export const authSchema = { user, session, account, verification };
