// Every admin page's header (design spec 5, /admin): eyebrow "Admin", the tab name, and the line
// that says what admins never see. Server Component.
import { ADMIN_PRIVACY_LINE } from "@/lib/admin-tabs";
import { PageHeader } from "../PageHeader";

export function AdminHeader({ title }: { title: string }) {
  return <PageHeader eyebrow="Admin" title={title} description={ADMIN_PRIVACY_LINE} />;
}
