// /admin/sign-up (settings.manage): the user cap and the Scaler access code. Design spec 5,
// Sign-up; M4-DESIGN 10.2 for the code. Called "Sign-up", not "Settings", so it is never confused
// with the person's own /settings.
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { SignupView } from "@/components/admin/SignupView";
import { NoticeBanners, NoticeProvider } from "@/components/notices";
import { CardsSkeleton } from "@/components/Skeleton";
import { getSignupSettings } from "@/lib/admin-db";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Sign-up · Admin" };

export default function SignupPage() {
  return (
    <NoticeProvider>
      <AdminHeader title="Sign-up" />
      <NoticeBanners />
      <Suspense fallback={<CardsSkeleton cards={2} rows={2} />}>
        <SignupContent />
      </Suspense>
    </NoticeProvider>
  );
}

async function SignupContent() {
  await requirePermission("settings.manage", { onDenied: "not-found" });
  return <SignupView settings={await getSignupSettings()} />;
}
