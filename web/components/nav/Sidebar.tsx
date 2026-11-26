// Desktop sidebar, 1024 px and wider (design spec 3.2 and 3.5). Server Component. The visible
// sections and the Admin link depend on the user, so the links stream in; until then only Home
// and Roadmap (always visible) show.
import { Suspense } from "react";
import { visibleHrefs } from "@/lib/nav";
import { AccountSkeleton, SidebarAccount } from "../account/Account";
import { BrandLockup } from "../Brand";
import { DaysLeft } from "../clock";
import { NavCount } from "./NavCount";
import { NavLink } from "./NavLink";
import { getNavData } from "./navData";
import { sectionFor } from "./sections";

function SectionLinks({ hrefs }: { hrefs: readonly string[] }) {
  return (
    <ul className="grid gap-1">
      {hrefs.map((href) => {
        const countKey = sectionFor(href)?.countKey;
        return (
          <li key={href}>
            <NavLink
              href={href}
              count={
                countKey && (
                  <Suspense fallback={null}>
                    <NavCount section={countKey} />
                  </Suspense>
                )
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

async function UserLinks() {
  const { sections, adminHref } = await getNavData();
  return (
    <>
      <SectionLinks hrefs={visibleHrefs(sections)} />
      <ul className="mt-2 grid gap-1 border-t border-line pt-2">
        <li>
          <NavLink href="/settings" item="settings" />
        </li>
        {adminHref && (
          <li>
            <NavLink href={adminHref} item="admin" />
          </li>
        )}
      </ul>
    </>
  );
}

export function Sidebar() {
  return (
    <div className="fixed inset-y-0 left-0 z-20 hidden w-[248px] flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
      <BrandLockup size="sm" className="px-3" />
      {/* On short windows the links scroll, while the lockup and the foot stay put. The padding
          keeps focus rings inside the scrolling box. */}
      <nav aria-label="Sections" className="-mx-1 mt-5 min-h-0 overflow-y-auto px-1 py-1">
        <Suspense fallback={<SectionLinks hrefs={["/", "/roadmap"]} />}>
          <UserLinks />
        </Suspense>
      </nav>
      {/* minmax(0, 1fr): lets a long name truncate instead of widening the sidebar. */}
      <div className="mt-auto grid grid-cols-[minmax(0,1fr)] pt-2">
        <p className="type-small px-3 text-muted">
          Readiness review · <DaysLeft />
        </p>
        <div className="mt-2 border-t border-line pt-2">
          <Suspense fallback={<AccountSkeleton />}>
            <SidebarAccount />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
