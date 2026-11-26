// The admin pages (design spec 5, /admin): AdminTabs on top of each, showing only the tabs the
// user may open. Each page checks its own permission on the server (requirePermission); hiding a
// tab is not the protection.
import { Suspense, cache } from "react";
import { AdminTabs, AdminTabsSkeleton } from "@/components/admin/AdminTabs";
import { visibleAdminTabs } from "@/lib/admin-tabs";
import { getWaitlistQueue } from "@/lib/admin-db";
import { describeError, rethrowNextControl } from "@/lib/safe-log";
import { getIdentity } from "@/lib/session";

const waitingCount = cache(async () => (await getWaitlistQueue()).waiting);

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <Suspense fallback={<AdminTabsSkeleton />}>
        <Tabs />
      </Suspense>
      {children}
    </>
  );
}

async function Tabs() {
  const me = await getIdentity();
  const tabs = me?.status === "active" ? visibleAdminTabs(me.permissions) : [];
  if (tabs.length === 0) return null;
  let waiting: number | null = null;
  if (tabs.some((t) => t.key === "waitlist")) {
    try {
      waiting = await waitingCount();
    } catch (error) {
      // The count is a nicety; the tabs still work without it.
      rethrowNextControl(error);
      console.error(`Admin tabs: waitlist count failed (${describeError(error)})`);
    }
  }
  return <AdminTabs tabs={tabs.map(({ key, label, href }) => ({ key, label, href }))} waiting={waiting} />;
}
