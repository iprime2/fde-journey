// The admin pages, one per tab, each behind its own permission (design spec 5, /admin). Pure,
// safe to import anywhere. Hiding a tab is not the protection: every page and action checks its
// permission on the server.
import type { Permission } from "./access-types";

export const ADMIN_TABS = [
  { key: "overview", label: "Overview", href: "/admin", permission: "metrics.view" },
  { key: "users", label: "Users", href: "/admin/users", permission: "users.view" },
  { key: "waitlist", label: "Waitlist", href: "/admin/waitlist", permission: "waitlist.manage" },
  { key: "sign-up", label: "Sign-up", href: "/admin/sign-up", permission: "settings.manage" },
  { key: "admins", label: "Admins", href: "/admin/admins", permission: "admins.manage" },
  { key: "audit", label: "Audit log", href: "/admin/audit", permission: "audit.view" },
] as const satisfies readonly { key: string; label: string; href: string; permission: Permission }[];

export type AdminTab = (typeof ADMIN_TABS)[number];
export type AdminHref = AdminTab["href"];

/** The tabs a user with these permissions may open, in tab order. */
export const visibleAdminTabs = (permissions: readonly Permission[]): AdminTab[] => ADMIN_TABS.filter((t) => permissions.includes(t.permission));

/** Where the Admin link goes: the first tab the user may open, or null (no Admin link at all). */
export const firstAdminHref = (permissions: readonly Permission[]): AdminHref | null => visibleAdminTabs(permissions)[0]?.href ?? null;

/** Whether `pathname` is an admin page (Admin is then current in the navigation). */
export const isAdminPath = (pathname: string) => pathname === "/admin" || pathname.startsWith("/admin/");

/** The tab `pathname` belongs to. */
export const currentAdminTab = (pathname: string): AdminTab | null =>
  [...ADMIN_TABS].reverse().find((t) => (t.href === "/admin" ? pathname === "/admin" : pathname === t.href || pathname.startsWith(`${t.href}/`))) ?? null;

/** The description under every admin page heading. */
export const ADMIN_PRIVACY_LINE = "Counts and dates only. Notes, links, Weekly notes and email addresses are never shown here.";
