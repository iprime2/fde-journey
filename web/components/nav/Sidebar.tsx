// Desktop sidebar, 1024 px and wider (design spec 3.2). Server Component.
import { Suspense } from "react";
import { AccountSkeleton, SidebarAccount } from "../account/Account";
import { BrandLockup } from "../Brand";
import { DaysLeft } from "../clock";
import { NavCount } from "./NavCount";
import { NavLink } from "./NavLink";
import { SECTIONS } from "./sections";

export function Sidebar() {
  return (
    <div className="fixed inset-y-0 left-0 z-20 hidden w-[248px] flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
      <BrandLockup size="sm" className="px-3" />
      <nav aria-label="Sections" className="mt-6">
        <ul className="grid gap-1">
          {SECTIONS.map((s) => (
            <li key={s.href}>
              <NavLink
                href={s.href}
                count={
                  s.countKey && (
                    <Suspense fallback={null}>
                      <NavCount section={s.countKey} />
                    </Suspense>
                  )
                }
              />
            </li>
          ))}
        </ul>
      </nav>
      {/* minmax(0, 1fr): lets a long name truncate instead of widening the sidebar. */}
      <div className="mt-auto grid grid-cols-[minmax(0,1fr)]">
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
