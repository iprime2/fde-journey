"use client";

// Admin Waitlist (design spec 5): "Let people in" (the next N, through a Dialog), then the queue in
// order with Let in (one tap) and Remove (a Dialog, it deletes their account) on each row.
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { letIn, letInNext, loadMoreWaitlist, removeFromWaitlist } from "@/app/actions/admin";
import type { WaitlistPage, WaitlistRow } from "@/lib/admin-db";
import { formatCount, formatIstDateTime, letInDefault, letInMax, letInResult, parseWholeNumber, people } from "@/lib/admin-format";
import { CARD_STYLES } from "../Card";
import { cn } from "../cn";
import { type ConfirmOutcome, ConfirmDialog } from "../Dialog";
import { callAction, useActionFailure, useNotices } from "../notices";
import { InlineButton } from "../save/SaveLines";
import { useCanWrite, useSaveStatus } from "../save/SaveStatusProvider";
import { Spinner, buttonStyles } from "../ui";
import { PersonCell } from "./Person";
import { CardFacts, type Column, EmptyBox, ResponsiveTable, focusVisible } from "./ResponsiveTable";

export function WaitlistView({ queue, canChangeCap }: { queue: WaitlistPage; canChangeCap: boolean }) {
  const notices = useNotices();
  const save = useSaveStatus();
  const failure = useActionFailure();
  const canWrite = useCanWrite(false);
  const queueHeading = useRef<HTMLHeadingElement>(null);
  const queueTitleId = useId();

  const [source, setSource] = useState(queue);
  const [rows, setRows] = useState(queue.rows);
  const [counts, setCounts] = useState({ free: queue.free, waiting: queue.waiting });
  const [nextOffset, setNextOffset] = useState(queue.nextOffset);
  if (queue !== source) {
    setSource(queue);
    setRows(queue.rows);
    setCounts({ free: queue.free, waiting: queue.waiting });
    setNextOffset(queue.nextOffset);
  }
  const [pending, setPending] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [removing, setRemoving] = useState<WaitlistRow | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  /** The row goes: focus to the next row's Let in, or the queue's heading when none is left. */
  function dropRow(row: WaitlistRow, admitted: boolean) {
    const index = rows.findIndex((r) => r.id === row.id);
    const rest = rows.filter((r) => r.id !== row.id).map((r, i) => ({ ...r, place: i + 1 }));
    setRows(rest);
    setCounts((c) => ({ free: admitted ? Math.max(0, c.free - 1) : c.free, waiting: Math.max(0, c.waiting - 1) }));
    const next = rest[Math.min(index, rest.length - 1)];
    requestAnimationFrame(() => {
      if (!(next && focusVisible(`[data-let-in="${next.id}"]:not(:disabled)`)) && !(next && focusVisible(`[data-remove="${next.id}"]`))) queueHeading.current?.focus();
    });
  }

  async function letInOne(row: WaitlistRow) {
    setPending(row.id);
    setRowError(null);
    const result = await callAction(() => letIn(row.id));
    setPending(null);
    if (result.ok) {
      notices.info(`${row.name} was let in.`);
      dropRow(row, true);
      return;
    }
    const outcome = failure(result.error);
    if (outcome && "error" in outcome) setRowError({ id: row.id, message: outcome.error });
  }

  async function remove(row: WaitlistRow): Promise<ConfirmOutcome> {
    const result = await callAction(() => removeFromWaitlist(row.id));
    if (!result.ok) return failure(result.error);
    notices.info(`${row.name} was removed from the waitlist.`);
    dropRow(row, false);
    return null;
  }

  async function loadMore() {
    if (nextOffset === null) return;
    setLoadingMore(true);
    const result = await callAction(() => loadMoreWaitlist(nextOffset));
    setLoadingMore(false);
    if (!result.ok) {
      if (result.error.code === "signed-out") save.markSignedOut();
      else notices.error(result.error.message);
      return;
    }
    const firstNew = result.value.rows[0]?.id;
    setRows((list) => [...list, ...result.value.rows.filter((r) => !list.some((x) => x.id === r.id))]);
    setNextOffset(result.value.nextOffset);
    if (firstNew) requestAnimationFrame(() => focusVisible(`[data-row="${firstNew}"] [data-person-link]`));
  }

  const full = counts.free === 0;

  function actions(row: WaitlistRow) {
    const busy = pending === row.id;
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-let-in={row.id}
          disabled={!canWrite || full || busy}
          aria-busy={busy || undefined}
          onClick={() => void letInOne(row)}
          className={buttonStyles.secondarySm}
        >
          {busy && <Spinner />}
          {busy ? "Letting in…" : "Let in"}
          <span className="sr-only"> {row.name}</span>
        </button>
        <button type="button" data-remove={row.id} disabled={!canWrite} onClick={() => setRemoving(row)} className={buttonStyles.dangerSecondarySm}>
          Remove<span className="sr-only"> {row.name}</span>
        </button>
      </div>
    );
  }

  function person(row: WaitlistRow, heading = false) {
    const errorId = `waitlist-error-${row.id}`;
    return (
      <div data-row={row.id}>
        <PersonCell person={row} heading={heading}>
          {rowError?.id === row.id && (
            <p className="type-small text-danger">
              <span id={errorId}>{rowError.message}</span>{" "}
              <InlineButton describedBy={errorId} disabled={!canWrite || full} onClick={() => void letInOne(row)}>
                Try again
              </InlineButton>
            </p>
          )}
        </PersonCell>
      </div>
    );
  }

  const columns: Column<WaitlistRow>[] = [
    { key: "place", header: "Place", className: "w-20", align: "right", cell: (r) => <span className="type-num">{formatCount(r.place)}</span> },
    { key: "person", header: "Person", rowHeader: true, cell: (r) => person(r) },
    { key: "joined", header: "Joined", className: "w-[230px]", cell: (r) => <span className="type-num">{formatIstDateTime(r.joinedAt)}</span> },
    { key: "actions", header: "Actions", className: "w-[200px]", cell: (r) => actions(r) },
  ];

  return (
    <>
      <LetPeopleIn free={counts.free} waiting={counts.waiting} cap={queue.cap} canChangeCap={canChangeCap} />
      <section aria-labelledby={queueTitleId} className="grid gap-3">
        <h2 ref={queueHeading} id={queueTitleId} tabIndex={-1} className="type-title w-fit">
          The queue
        </h2>
        {rows.length === 0 ? (
          <EmptyBox>Nobody is waiting.</EmptyBox>
        ) : (
          <ResponsiveTable
            caption={`Waitlist, in order. ${people(counts.waiting)}.`}
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            card={(r) => (
              <>
                <div className="flex items-start justify-between gap-2">
                  {person(r, true)}
                  <span className="type-num flex-none text-muted">
                    <span className="sr-only">Place </span>
                    {formatCount(r.place)}
                  </span>
                </div>
                <CardFacts facts={[{ term: "Joined", value: formatIstDateTime(r.joinedAt) }]} />
                {actions(r)}
              </>
            )}
          />
        )}
        {nextOffset !== null && (
          <button type="button" onClick={() => void loadMore()} disabled={loadingMore} aria-busy={loadingMore || undefined} className={cn(buttonStyles.secondary, "w-fit")}>
            {loadingMore && <Spinner />}
            Show 50 more
          </button>
        )}
      </section>
      {removing && (
        <ConfirmDialog
          tone="danger"
          title={`Remove ${removing.name} from the waitlist?`}
          body="This deletes their account and their place. If they sign in again, they join at the back."
          confirmLabel="Remove"
          pendingLabel="Removing…"
          onConfirm={() => remove(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}

/** "Let people in": the next N in order, never more than the free places or the people waiting. */
function LetPeopleIn({ free, waiting, cap, canChangeCap }: { free: number; waiting: number; cap: number; canChangeCap: boolean }) {
  const titleId = useId();
  const fieldId = useId();
  const errorId = useId();
  const field = useRef<HTMLInputElement>(null);
  const notices = useNotices();
  const failure = useActionFailure();
  const canWrite = useCanWrite(false);
  const max = letInMax(free, waiting);
  const [value, setValue] = useState(String(letInDefault(free, waiting)));
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<number | null>(null);
  // Keep the field in range when the counts change (after letting people in).
  const [lastMax, setLastMax] = useState(max);
  if (max !== lastMax) {
    setLastMax(max);
    setValue(String(letInDefault(free, waiting)));
    setError(null);
  }
  const full = free === 0;
  const disabled = !canWrite || max === 0;

  function ask() {
    const n = parseWholeNumber(value, 1, max);
    if (n === null) {
      setError(`Enter a number from 1 to ${formatCount(max)}.`);
      field.current?.focus();
      return;
    }
    setError(null);
    setAsking(n);
  }

  async function confirm(n: number): Promise<ConfirmOutcome> {
    const result = await callAction(() => letInNext(n));
    if (!result.ok) return failure(result.error);
    notices.info(letInResult(result.value.admitted));
    return null;
  }

  return (
    <section aria-labelledby={titleId} className={cn(CARD_STYLES, "grid gap-3 px-4 py-3.5")}>
      <h2 id={titleId} className="type-title">
        Let people in
      </h2>
      {full ? (
        <p className="type-small text-ink">
          All {formatCount(cap)} places are taken.{" "}
          {canChangeCap ? (
            <>
              Raise the cap in{" "}
              <Link href="/admin/sign-up" className="text-accent underline underline-offset-2">
                Sign-up
              </Link>{" "}
              to let more people in.
            </>
          ) : (
            "Ask an admin who can change the cap."
          )}
        </p>
      ) : (
        <p className="type-num text-muted">
          {formatCount(free)} {free === 1 ? "place" : "places"} free · {formatCount(waiting)} waiting
        </p>
      )}
      <form
        className="grid gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <label htmlFor={fieldId} className="type-body-strong w-fit">
          How many
        </label>
        <div className="flex flex-wrap items-start gap-2">
          <input
            ref={field}
            id={fieldId}
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn("type-input h-11 w-24 rounded-md border bg-surface px-3 text-ink disabled:opacity-50", error ? "border-danger" : "border-line-strong")}
          />
          <button type="submit" disabled={disabled} className={buttonStyles.primary}>
            Let them in
          </button>
        </div>
        {error && (
          <p id={errorId} className="type-small text-danger">
            {error}
          </p>
        )}
      </form>
      {asking !== null && (
        <ConfirmDialog
          tone="primary"
          title={asking === 1 ? "Let in the next person?" : `Let in the next ${formatCount(asking)} people?`}
          body="They get a place in the order they joined. They'll see it the next time they sign in."
          confirmLabel="Let them in"
          pendingLabel="Letting in…"
          onConfirm={() => confirm(asking)}
          onClose={() => setAsking(null)}
        />
      )}
    </section>
  );
}
