// /admin/admins (admins.manage; at first only the owner). Design spec 5, Admins.
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminsView } from "@/components/admin/AdminsView";
import { NoticeBanners, NoticeProvider } from "@/components/notices";
import { CardsSkeleton } from "@/components/Skeleton";
import { listAdmins } from "@/lib/admin-db";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Admins · Admin" };

export default function AdminsPage() {
  return (
    <NoticeProvider>
      <AdminHeader title="Admins" />
      <NoticeBanners />
      <Suspense fallback={<CardsSkeleton cards={2} rows={3} />}>
        <AdminsContent />
      </Suspense>
    </NoticeProvider>
  );
}

async function AdminsContent() {
  const actor = await requirePermission("admins.manage", { onDenied: "not-found" });
  return <AdminsView list={await listAdmins()} isSuperAdmin={actor.isSuperAdmin} meId={actor.userId} />;
}
