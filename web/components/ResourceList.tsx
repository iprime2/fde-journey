"use client";

import { useId } from "react";
import { OPEN_RESOURCES_KEY } from "@/lib/open-state";
import { Caret } from "./Card";
import { useFilter } from "./filter/FilterProvider";
import { useRememberedOpen } from "./useRememberedOpen";

const NO_DEFAULTS: string[] = [];

/** "› Learning resources x/y" under a roadmap task (design spec 4, ResourceList). */
export function ResourceList({ taskId, summary, children }: { taskId: string; summary: React.ReactNode; children: React.ReactNode }) {
  const f = useFilter();
  const bodyId = useId();
  const { open, toggle } = useRememberedOpen({
    storageKey: OPEN_RESOURCES_KEY,
    member: taskId,
    defaults: NO_DEFAULTS,
    matchInside: f.visibility.openParents.has(taskId),
  });
  return (
    <div className="col-span-full -mt-2 mb-1 pl-3 md:col-start-2 md:pl-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={toggle}
        className="type-small flex min-h-11 w-fit items-center gap-2 rounded-sm text-left font-semibold text-accent"
      >
        <Caret open={open} />
        {summary}
      </button>
      <div id={bodyId} hidden={!open}>
        {children}
      </div>
    </div>
  );
}
