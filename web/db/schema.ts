// Database schema (Drizzle, Postgres). Migrations are generated from this file with
// `npm run db:generate` and committed in db/migrations/. Never edit a merged migration.
import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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

export const user = pgTable("user", {
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
});

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

/** The tables Better Auth's Drizzle adapter needs, keyed by its model names. */
export const authSchema = { user, session, account, verification };
