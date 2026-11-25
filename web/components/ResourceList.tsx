"use client";

import { OPEN_RESOURCES_KEY } from "@/lib/open-state";
import { useFilter } from "./filter/FilterProvider";
import { useRememberedDetails } from "./useRememberedDetails";

const NO_DEFAULTS: string[] = [];

/** "› Learning resources x/y" under a roadmap task (design spec 4, ResourceList). */
export function ResourceList({ taskId, summary, children }: { taskId: string; summary: React.ReactNode; children: React.ReactNode }) {
  const f = useFilter();
  const { open, onToggle } = useRememberedDetails({
    storageKey: OPEN_RESOURCES_KEY,
    member: taskId,
    defaults: NO_DEFAULTS,
    matchInside: f.visibility.openParents.has(taskId),
  });
  return (
    <details open={open} onToggle={onToggle} className="group/res col-span-full -mt-2 mb-1 pl-3 md:col-start-2 md:pl-0">
      <summary className="type-small flex min-h-11 w-fit items-center gap-2 rounded-sm font-semibold text-accent">
        <span aria-hidden="true" className="font-mono motion-safe:transition-transform motion-safe:duration-200 group-open/res:rotate-90">
          ›
        </span>
        {summary}
      </summary>
      {children}
    </details>
  );
}
