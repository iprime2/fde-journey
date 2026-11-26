"use client";

// The <li> of an item row. It hides itself when the page filter leaves it out, and holds the
// row's tick: optimistic (it changes at once), saved through toggleDone, and on failure back to
// the saved value with "Couldn't save this tick." and Try again (design spec 4, ItemRow).
import { createContext, startTransition, use, useOptimistic, useRef, useState } from "react";
import { toggleDone } from "@/app/actions/progress";
import { useFilter } from "../filter/FilterProvider";
import { safeCall } from "../save/safeCall";
import { useCanWrite, useSaveStatus } from "../save/SaveStatusProvider";

interface RowState {
  done: boolean;
  canWrite: boolean;
  toggle(next: boolean): void;
  /** Set after a failed tick: the value it tried to save. */
  failedTarget: boolean | null;
  retry(): void;
  /** The tick box, so Try again can move focus to it. */
  tickRef: React.RefObject<HTMLInputElement | null>;
}

const RowContext = createContext<RowState | null>(null);

export function RowShell({
  id,
  done,
  readOnly,
  className,
  children,
}: {
  id: string;
  /** Saved value from the server. */
  done: boolean;
  readOnly: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const f = useFilter();
  const page = useSaveStatus();
  const canWrite = useCanWrite(readOnly);
  const [shownDone, setShownDone] = useOptimistic(done);
  const [failedTarget, setFailedTarget] = useState<boolean | null>(null);
  const tickRef = useRef<HTMLInputElement>(null);
  const failureKey = `tick:${id}`;

  function toggle(next: boolean) {
    startTransition(async () => {
      setShownDone(next);
      const result = await safeCall(() => toggleDone(id, next));
      if (result.ok) {
        setFailedTarget(null);
        page.clearFailure(failureKey);
      } else if (result.error.code === "signed-out") {
        // The signed-out banner explains it; the box goes back to its saved value.
        setFailedTarget(null);
        page.markSignedOut();
      } else {
        setFailedTarget(next);
        page.reportFailure(failureKey);
      }
    });
  }

  const state: RowState = {
    done: shownDone,
    canWrite,
    toggle,
    failedTarget,
    retry: () => {
      if (failedTarget === null) return;
      // The message and its Try again go once the tick saves, so focus moves to the box first.
      tickRef.current?.focus();
      toggle(failedTarget);
    },
    tickRef,
  };

  return (
    <RowContext value={state}>
      <li id={`item-${id}`} hidden={f.provided && !f.visibility.items.has(id)} className={className}>
        {children}
      </li>
    </RowContext>
  );
}

export function useRow(): RowState {
  const row = use(RowContext);
  if (!row) throw new Error("useRow must be used inside a RowShell");
  return row;
}
