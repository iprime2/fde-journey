// /admin/waitlist (waitlist.manage). Design spec 5, Waitlist.
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { WaitlistView } from "@/components/admin/WaitlistView";
import { NoticeBanners, NoticeProvider } from "@/components/notices";
import { CardsSkeleton } from "@/components/Skeleton";
import { getWaitlistQueue } from "@/lib/admin-db";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Waitlist · Admin" };

export default function WaitlistAdminPage() {
  return (
    <NoticeProvider>
      <AdminHeader title="Waitlist" />
      <NoticeBanners />
      <Suspense fallback={<CardsSkeleton cards={2} rows={3} />}>
        <WaitlistContent />
      </Suspense>
    </NoticeProvider>
  );
}

async function WaitlistContent() {
  const actor = await requirePermission("waitlist.manage", { onDenied: "not-found" });
  const queue = await getWaitlistQueue();
  return <WaitlistView queue={queue} canChangeCap={actor.isSuperAdmin || actor.permissions.includes("settings.manage")} />;
}
