// /admin/audit (audit.view): every admin action, newest first. Design spec 5, Audit log.
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AuditView } from "@/components/admin/AuditView";
import { NoticeBanners, NoticeProvider } from "@/components/notices";
import { ListSkeleton } from "@/components/Skeleton";
import { AUDIT_FILTERS } from "@/lib/access-types";
import { listAuditLog } from "@/lib/admin-db";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Audit log · Admin" };

export default function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <NoticeProvider>
      <AdminHeader title="Audit log" />
      <NoticeBanners />
      <Suspense fallback={<ListSkeleton />}>
        <AuditContent searchParams={searchParams} />
      </Suspense>
    </NoticeProvider>
  );
}

async function AuditContent({ searchParams }: Pick<PageProps<"/admin/audit">, "searchParams">) {
  await requirePermission("audit.view", { onDenied: "not-found" });
  const raw = (await searchParams).action;
  const value = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  const filter = Object.hasOwn(AUDIT_FILTERS, value) ? value : "all";
  return <AuditView page={await listAuditLog({ filter })} filter={filter} />;
}
