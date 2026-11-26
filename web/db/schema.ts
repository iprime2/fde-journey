// Database schema (Drizzle, Postgres). Migrations are generated from this file with
// `npm run db:generate` and committed in db/migrations/. Never edit a merged migration.
import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const tz = { withTimezone: true, mode: "date" } as const;

/**
 * Saved progress, one row per item id (lib/ids.ts), same fields as the tracker's records.
 * Single-owner app: rows belong to the owner, so there is no user id column.
 */
export const progress = pgTable(
  "progress",
  {
    itemId: text("item_id").primaryKey(),
    done: boolean("done").notNull().default(false),
    note: text("note").notNull().default(""),
    link: text("link").notNull().default(""),
    doneAt: timestamp("done_at", tz),
    updatedAt: timestamp("updated_at", tz).notNull().defaultNow(),
  },
  (t) => [
    // Defence in depth: the server validates first, these only stop bad rows from any other path.
    check("progress_note_length", sql`char_length(${t.note}) <= 10000`),
    check("progress_link_length", sql`char_length(${t.link}) <= 2000`),
    check("progress_link_https", sql`${t.link} = '' OR ${t.link} ~* '^https://'`),
    check("progress_done_at", sql`${t.done} OR ${t.doneAt} IS NULL`),
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
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/** The tables Better Auth's Drizzle adapter needs, keyed by its model names. */
export const authSchema = { user, session, account, verification };
