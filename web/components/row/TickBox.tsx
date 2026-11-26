"use client";

import { useId } from "react";
import { CheckIcon } from "../icons";
import { InlineButton } from "../save/SaveLines";
import { useRow } from "./RowShell";

/** A real checkbox in a 44 by 44 px label cell (design spec 4, ItemRow). */
export function TickBox({ title }: { title: string }) {
  const row = useRow();
  return (
    <label className={`tick-cell relative grid size-11 place-items-center ${row.canWrite ? "cursor-pointer" : "cursor-not-allowed"}`}>
      <input
        type="checkbox"
        className="tick peer"
        checked={row.done}
        disabled={!row.canWrite}
        onChange={(e) => row.toggle(e.target.checked)}
        aria-label={`Mark done: ${title}`}
      />
      <CheckIcon size={14} className="pointer-events-none absolute hidden text-accent-ink peer-checked:block" />
    </label>
  );
}

/** "Couldn't save this tick." with Try again, under the title after a failed tick. */
export function TickError() {
  const row = useRow();
  const messageId = useId();
  if (row.failedTarget === null) return null;
  return (
    <p className="type-small mt-1 text-danger">
      <span id={messageId}>Couldn&apos;t save this tick.</span>{" "}
      <InlineButton describedBy={messageId} onClick={row.retry} disabled={!row.canWrite}>
        Try again
      </InlineButton>
    </p>
  );
}
