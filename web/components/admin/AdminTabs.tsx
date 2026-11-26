"use client";

// AdminTabs (design spec 4, v0.5): links to the admin pages the user may open, at the top of
// every /admin page. The Waitlist tab carries the number of people waiting.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type AdminTab, currentAdminTab } from "@/lib/admin-tabs";
import { cn } from "../cn";

export function AdminTabs({ tabs, waiting }: { tabs: Pick<AdminTab, "key" | "label" | "href">[]; waiting: number | null }) {
  const pathname = usePathname();
  const current = currentAdminTab(pathname)?.key;
  return (
    <nav aria-label="Admin pages">
      <ul className="flex flex-wrap gap-x-2">
        {tabs.map((tab) => {
          const isCurrent = tab.key === current;
          return (
            <li key={tab.key}>
              <Link href={tab.href} aria-current={isCurrent ? "page" : undefined} className="group flex min-h-11 items-center rounded-md">
                <span
                  className={cn(
                    "type-body-strong flex h-9 items-center gap-2 rounded-md px-3.5 motion-safe:transition-[color,background-color] motion-safe:duration-150",
                    isCurrent ? "bg-accent-soft text-accent group-hover:bg-hover" : "text-ink group-hover:bg-hover",
                  )}
                >
                  {tab.label}
                  {tab.key === "waitlist" && waiting !== null && (
                    <span className="type-num text-muted">
                      <span aria-hidden="true">{waiting}</span>
                      <span className="sr-only">, {waiting} waiting</span>
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Same height as the tabs, while the user's permissions load. */
export function AdminTabsSkeleton() {
  return (
    <div aria-hidden="true" className="flex min-h-11 items-center gap-2">
      {[72, 52, 76, 64].map((w) => (
        <span key={w} style={{ width: w }} className="h-5 rounded-sm bg-sunk motion-safe:animate-skeleton" />
      ))}
    </div>
  );
}
