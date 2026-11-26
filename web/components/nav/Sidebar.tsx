// Desktop sidebar, 1024 px and wider (design spec 3.2). Server Component.
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { cn } from "../cn";
import { DaysLeft } from "../clock";
import { LogOutIcon } from "../icons";
import { buttonStyles } from "../ui";
import { NavCount } from "./NavCount";
import { NavLink } from "./NavLink";
import { SECTIONS } from "./sections";

export function Sidebar() {
  return (
    <div className="fixed inset-y-0 left-0 z-20 hidden w-[248px] flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
      <div className="px-3">
        <p className="type-label text-accent">AI Engineering &amp; FDE</p>
        <p className="type-title">FDE Journey</p>
      </div>
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
      <div className="mt-auto grid gap-2">
        <p className="type-small px-3 text-muted">
          Readiness review · <DaysLeft />
        </p>
        <form action={signOut}>
          <button type="submit" className={cn(buttonStyles.ghost, "w-full justify-start gap-3 px-3")}>
            <LogOutIcon size={20} />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
