// /admin/users (users.view; Suspend and Reactivate need users.manage). Design spec 5, Users.
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { UsersView } from "@/components/admin/UsersView";
import { NoticeBanners, NoticeProvider } from "@/components/notices";
import { ListSkeleton } from "@/components/Skeleton";
import { USER_FILTERS, type UserFilter, listAdminUsers } from "@/lib/admin-db";
import { requirePermission } from "@/lib/session";
import { getNowMs } from "@/lib/today";

export const metadata: Metadata = { title: "Users · Admin" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <NoticeProvider>
      <AdminHeader title="Users" />
      <NoticeBanners />
      <Suspense fallback={<ListSkeleton />}>
        <UsersContent searchParams={searchParams} />
      </Suspense>
    </NoticeProvider>
  );
}

async function UsersContent({ searchParams }: Pick<PageProps<"/admin/users">, "searchParams">) {
  const actor = await requirePermission("users.view", { onDenied: "not-found" });
  const sp = await searchParams;
  const q = first(sp.q).slice(0, 100);
  const raw = first(sp.status);
  const filter: UserFilter = (USER_FILTERS as readonly string[]).includes(raw) ? (raw as UserFilter) : "all";
  const page = await listAdminUsers({ q, filter });
  const nowMs = await getNowMs();
  return (
    <UsersView
      page={page}
      q={q}
      filter={filter}
      canManage={actor.isSuperAdmin || actor.permissions.includes("users.manage")}
      meId={actor.userId}
      nowMs={nowMs}
    />
  );
}
