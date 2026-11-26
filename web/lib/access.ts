// A user's access, read fresh from the database: status, GitHub username, whether they are the
// owner (the super admin), and their admin permissions. Server-only. Used by the session check
// (lib/session.ts) on every request and by the sign-in gate (lib/auth.ts); never cached.
import "server-only";
import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { user } from "@/db/schema";
import { PERMISSIONS, type Permission, type UserStatus, isPermission } from "./access-types";

/** The user's status, owner flag and permissions, straight from the database. */
export interface Access {
  status: UserStatus;
  githubLogin: string | null;
  isOwner: boolean;
  permissions: Permission[];
}

/** Reads access fresh from the database (never cached). Null when the user doesn't exist. */
export async function loadAccess(db: Db, userId: string, ownerId: string | null): Promise<Access | null> {
  // Columns in the sub-queries are written out in full ("user"."id"): Drizzle prints its own
  // column objects unqualified here, and a bare "id" would mean the sub-query's own table.
  const rows = await db
    .select({
      status: user.status,
      githubLogin: user.githubLogin,
      isOwner: sql<boolean>`exists (select 1 from "account" a where a."user_id" = "user"."id" and a."provider_id" = 'github' and a."account_id" = ${ownerId ?? ""})`,
      permissions: sql<string>`coalesce((select string_agg(p."permission", ',' order by p."permission") from "user_permission" p where p."user_id" = "user"."id"), '')`,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const isOwner = row.isOwner === true || (row.isOwner as unknown) === "t";
  const stored = String(row.permissions ?? "")
    .split(",")
    .filter(isPermission)
    .sort((a, b) => PERMISSIONS.indexOf(a) - PERMISSIONS.indexOf(b));
  return { status: row.status, githubLogin: row.githubLogin, isOwner, permissions: isOwner ? [...PERMISSIONS] : stored };
}
