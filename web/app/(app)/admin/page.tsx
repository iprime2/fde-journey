// /admin: Overview (metrics.view). Without that permission it goes to the first admin page the
// user may open, or shows the not-found page when there is none (design spec 5).
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense, useId } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { CARD_STYLES, CardHead } from "@/components/Card";
import { NoticeBanners, NoticeProvider } from "@/components/notices";
import { CardsSkeleton } from "@/components/Skeleton";
import { Tile } from "@/components/Tile";
import { ProgressBar } from "@/components/ui";
import { type AdminOverview, getAdminOverview } from "@/lib/admin-db";
import { formatCount } from "@/lib/admin-format";
import { firstAdminHref } from "@/lib/admin-tabs";
import { formatWeekdayDate } from "@/lib/dates";
import { getIdentity, requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Overview · Admin" };

export default function OverviewPage() {
  return (
    <NoticeProvider>
      <AdminHeader title="Overview" />
      <NoticeBanners />
      <Suspense fallback={<CardsSkeleton cards={2} rows={3} />}>
        <OverviewContent />
      </Suspense>
    </NoticeProvider>
  );
}

async function OverviewContent() {
  const me = await getIdentity();
  if (me?.status === "active" && !me.permissions.includes("metrics.view")) {
    const first = firstAdminHref(me.permissions);
    if (first && first !== "/admin") redirect(first);
  }
  const actor = await requirePermission("metrics.view", { onDenied: "not-found" });
  const data = await getAdminOverview();
  const canSeeWaitlist = actor.isSuperAdmin || actor.permissions.includes("waitlist.manage");
  return (
    <>
      <Tiles data={data} waitlistLink={canSeeWaitlist} />
      <SignupsCard weeks={data.signupsPerWeek} />
    </>
  );
}

function Tiles({ data, waitlistLink }: { data: AdminOverview; waitlistLink: boolean }) {
  const percent = data.cap > 0 ? Math.round((data.taken / data.cap) * 100) : 100;
  return (
    <section aria-label="Summary">
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <li className="col-span-2 grid">
          <Tile
            value={`${formatCount(data.taken)}/${formatCount(data.cap)}`}
            srValue={`${formatCount(data.taken)} of ${formatCount(data.cap)} places taken`}
            label={`places taken · ${formatCount(data.free)} free`}
          >
            <ProgressBar percent={percent} className="mt-1.5" />
          </Tile>
        </li>
        <li className="grid">
          <Tile value={formatCount(data.waiting)} label="people waiting" href={waitlistLink ? "/admin/waitlist" : undefined} />
        </li>
        <li className="grid">
          <Tile value={formatCount(data.active7)} label="used the app in the last 7 days" />
        </li>
        <li className="grid">
          <Tile value={formatCount(data.active30)} label="used the app in the last 30 days" />
        </li>
        <li className="grid">
          <Tile value={formatCount(data.doneThisWeek)} label="items marked done since Monday, all users" />
        </li>
      </ul>
    </section>
  );
}

function SignupsCard({ weeks }: { weeks: AdminOverview["signupsPerWeek"] }) {
  const titleId = useId();
  const busiest = Math.max(1, ...weeks.map((w) => w.count));
  const any = weeks.some((w) => w.count > 0);
  return (
    <section aria-labelledby={titleId} className={CARD_STYLES}>
      <CardHead
        titleId={titleId}
        title="Sign-ups per week"
        sub="Last 8 weeks. Weeks start on Monday (IST). Includes people who joined the waitlist."
      />
      {any ? (
        <div className="px-1 pb-1">
          <table className="w-full table-fixed border-collapse">
            <caption className="sr-only">Sign-ups per week, last 8 weeks, newest first</caption>
            <thead>
              <tr>
                <th scope="col" className="type-label w-[140px] border-b border-line px-3 py-2.5 text-left text-muted">
                  Week of
                </th>
                <th scope="col" className="type-label w-24 border-b border-line px-3 py-2.5 text-right text-muted">
                  Sign-ups
                </th>
                <td aria-hidden="true" className="border-b border-line" />
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.weekOf} className="border-t border-line first:border-t-0">
                  <th scope="row" className="type-num h-11 px-3 text-left font-medium">
                    {formatWeekdayDate(w.weekOf)}
                  </th>
                  <td className="type-num h-11 px-3 text-right">{formatCount(w.count)}</td>
                  <td aria-hidden="true" className="px-3">
                    <ProgressBar percent={(w.count / busiest) * 100} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="type-small px-4 pb-4 text-muted">No sign-ups yet.</p>
      )}
    </section>
  );
}

