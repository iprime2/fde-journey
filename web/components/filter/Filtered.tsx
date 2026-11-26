"use client";

// Thin wrappers that hide themselves when the page filter leaves nothing to show inside.
// The content inside them is rendered on the server.
import { emptyKind } from "@/lib/filter";
import { GroupLabel, buttonStyles } from "../ui";
import { useFilter } from "./FilterProvider";

/** A card (or any block) that holds the rows of one section. */
export function FilterSection({ section, className, children }: { section: string; className?: string; children: React.ReactNode }) {
  const f = useFilter();
  return (
    <div hidden={f.provided && !f.visibility.sections.has(section)} className={className}>
      {children}
    </div>
  );
}

/** "Core modules" and similar: hidden when nothing under it matches. */
export function FilterGroupLabel({ group, children }: { group: string; children: React.ReactNode }) {
  const f = useFilter();
  return <GroupLabel hidden={f.provided && !f.visibility.groups.has(group)}>{children}</GroupLabel>;
}

/** Shown when the filter hides every card. */
export function FilterEmpty() {
  const f = useFilter();
  if (!f.provided || f.visibility.sections.size > 0) return null;
  const kind = emptyKind(f.state, { anyNotes: f.anyNotes, anyDone: f.anyDone });
  return (
    <div className="type-small grid justify-items-center gap-3 rounded-lg border border-dashed border-line bg-surface p-7 text-center text-muted">
      {kind === "no-notes" && (
        // M2 copy (design spec 8). The Add note button arrives with the note editor in M2 part B.
        <p>No notes yet. Use Add note on any item.</p>
      )}
      {kind === "no-done" && <p>Nothing marked done yet.</p>}
      {kind === "no-match" && (
        <>
          <p>Nothing matches this search or filter.</p>
          <button type="button" className={buttonStyles.secondary} onClick={f.clear}>
            Clear search and filter
          </button>
        </>
      )}
    </div>
  );
}
