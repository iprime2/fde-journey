"use client";

// Admin Users (design spec 5): search and filter, then the people as a table (from 1280 px) or
// cards, newest sign-up first, 50 at a time. With users.manage: Suspend (a Dialog) on active
// people, Reactivate (one tap) on suspended ones; never on the owner's row or your own.
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { loadMoreUsers, reactivateUser, suspendUser } from "@/app/actions/admin";
import type { AdminUserPage, AdminUserRow, UserFilter } from "@/lib/admin-db";
import { doneLine, formatCount, formatIstDate, lastActiveLabel, people } from "@/lib/admin-format";
import type { ChipState } from "@/lib/status";
import { cn } from "../cn";
import { type ConfirmOutcome, ConfirmDialog } from "../Dialog";
import { callAction, useActionFailure, useNotices } from "../notices";
import { InlineButton } from "../save/SaveLines";
import { useCanWrite, useSaveStatus } from "../save/SaveStatusProvider";
import { Spinner, StatusChip, buttonStyles } from "../ui";
import { AdminToolbar, type ToolbarState } from "./AdminToolbar";
import { PersonCell } from "./Person";
import { CardFacts, type Column, EmptyBox, ResponsiveTable, focusVisible } from "./ResponsiveTable";

const FILTER_OPTIONS = [
  { value: "all", label: "All people" },
  { value: "active", label: "Active" },
  { value: "waitlisted", label: "Waitlisted" },
  { value: "suspended", label: "Suspended" },
  { value: "admins", label: "Admins" },
] as const;

const STATUS_CHIPS: Record<AdminUserRow["status"], ChipState> = {
  active: { label: "Active", variant: "ok" },
  waitlisted: { label: "Waitlisted", variant: "warn" },
  suspended: { label: "Suspended", variant: "danger" },
};

function Chips({ row }: { row: AdminUserRow }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <StatusChip chip={STATUS_CHIPS[row.status]} />
      {row.isOwner ? <StatusChip chip={{ label: "Owner", variant: "now" }} /> : row.isAdmin && <StatusChip chip={{ label: "Admin", variant: "neutral" }} />}
    </span>
  );
}

function Done({ row }: { row: AdminUserRow }) {
  return (
    <span className="grid">
      <span className="type-num">{formatCount(row.done.total)}</span>
      <span className="type-small text-muted">{doneLine(row.done)}</span>
    </span>
  );
}

export function UsersView({
  page,
  q,
  filter,
  canManage,
  meId,
  nowMs,
}: {
  page: AdminUserPage;
  q: string;
  filter: UserFilter;
  canManage: boolean;
  meId: string;
  nowMs: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const notices = useNotices();
  const save = useSaveStatus();
  const failure = useActionFailure();
  const canWrite = useCanWrite(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [toolbar, setToolbar] = useState<ToolbarState>({ q, show: filter });

  // The server's rows; they come again after every change (the actions refresh the page).
  const [source, setSource] = useState(page);
  const [rows, setRows] = useState(page.rows);
  const [nextOffset, setNextOffset] = useState(page.nextOffset);
  if (page !== source) {
    setSource(page);
    setRows(page.rows);
    setNextOffset(page.nextOffset);
  }
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [suspending, setSuspending] = useState<AdminUserRow | null>(null);

  const update = (id: string, change: Partial<AdminUserRow>) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...change } : r)));
  /** After Suspend or Reactivate, focus goes to the row's new button (or its name when there is none). */
  const focusRow = (id: string) =>
    requestAnimationFrame(() => focusVisible(`[data-row-action="${id}"]`) || focusVisible(`[data-row="${id}"] [data-person-link]`));

  async function suspend(row: AdminUserRow): Promise<ConfirmOutcome> {
    const result = await callAction(() => suspendUser(row.id));
    if (!result.ok) return failure(result.error);
    update(row.id, { status: "suspended" });
    notices.info(`${row.name} is suspended.`);
    focusRow(row.id);
    return null;
  }

  async function reactivate(row: AdminUserRow) {
    setPending(row.id);
    setRowError(null);
    const result = await callAction(() => reactivateUser(row.id));
    setPending(null);
    if (result.ok) {
      update(row.id, { status: result.value.status });
      notices.info(
        result.value.status === "active"
          ? `${row.name} can sign in again.`
          : `${row.name} is reactivated. All places are taken, so they joined the waitlist.`,
      );
      focusRow(row.id);
      return;
    }
    const outcome = failure(result.error);
    if (outcome && "error" in outcome) setRowError({ id: row.id, message: outcome.error });
  }

  async function loadMore() {
    if (nextOffset === null) return;
    setLoadingMore(true);
    setMoreError(null);
    const result = await callAction(() => loadMoreUsers(q, filter, nextOffset));
    setLoadingMore(false);
    if (!result.ok) {
      if (result.error.code === "signed-out") save.markSignedOut();
      else setMoreError(result.error.message);
      return;
    }
    const firstNew = result.value.rows[0]?.id;
    setRows((list) => [...list, ...result.value.rows.filter((r) => !list.some((x) => x.id === r.id))]);
    setNextOffset(result.value.nextOffset);
    if (firstNew) requestAnimationFrame(() => focusVisible(`[data-row="${firstNew}"] [data-person-link]`) || focusVisible(`[data-row="${firstNew}"] h3`));
  }

  function clear() {
    setToolbar({ q: "", show: "all" });
    if (pathname === "/admin/users") startTransition(() => router.replace("/admin/users", { scroll: false }));
    searchRef.current?.focus();
  }

  function actions(row: AdminUserRow) {
    if (!canManage || row.isOwner || row.id === meId) return null;
    const busy = pending === row.id;
    const button =
      row.status === "active" ? (
        <button type="button" data-row-action={row.id} disabled={!canWrite} onClick={() => setSuspending(row)} className={buttonStyles.dangerSecondarySm}>
          Suspend<span className="sr-only"> {row.name}</span>
        </button>
      ) : row.status === "suspended" ? (
        <button
          type="button"
          data-row-action={row.id}
          disabled={!canWrite || busy}
          aria-busy={busy || undefined}
          onClick={() => void reactivate(row)}
          className={buttonStyles.secondarySm}
        >
          {busy && <Spinner />}
          {busy ? "Reactivating…" : "Reactivate"}
          <span className="sr-only"> {row.name}</span>
        </button>
      ) : null;
    return button;
  }

  function errorLine(row: AdminUserRow) {
    if (rowError?.id !== row.id) return null;
    const id = `row-error-${row.id}`;
    return (
      <p className="type-small text-danger">
        <span id={id}>{rowError.message}</span>{" "}
        <InlineButton describedBy={id} disabled={!canWrite} onClick={() => void reactivate(row)}>
          Try again
        </InlineButton>
      </p>
    );
  }

  const columns: Column<AdminUserRow>[] = [
    {
      key: "person",
      header: "Person",
      rowHeader: true,
      cell: (r) => (
        <div data-row={r.id}>
          <PersonCell person={r}>{errorLine(r)}</PersonCell>
        </div>
      ),
    },
    { key: "status", header: "Status", className: "w-[130px]", cell: (r) => <Chips row={r} /> },
    { key: "signed-up", header: "Signed up", className: "w-28", cell: (r) => <span className="type-num">{formatIstDate(r.createdAt)}</span> },
    { key: "active", header: "Last active", className: "w-[120px]", cell: (r) => <span className="type-num">{lastActiveLabel(r.lastActiveAt, nowMs)}</span> },
    { key: "done", header: "Done", className: "w-[210px]", cell: (r) => <Done row={r} /> },
    ...(canManage ? [{ key: "actions", header: "Actions", className: "w-[116px]", cell: (r: AdminUserRow) => actions(r) }] : []),
  ];

  const filtered = q !== "" || filter !== "all";
  const caption = `People, newest sign-up first. ${formatCount(rows.length)} of ${formatCount(page.total)} shown.`;

  return (
    <>
      <AdminToolbar
        path="/admin/users"
        param="status"
        state={toolbar}
        options={FILTER_OPTIONS}
        placeholder="Search people…"
        announcement={`${people(page.total)} shown`}
        searchRef={searchRef}
        onChange={setToolbar}
      />
      {rows.length === 0 ? (
        <EmptyBox
          action={
            filtered && (
              <button type="button" className={buttonStyles.secondary} onClick={clear}>
                Clear search and filter
              </button>
            )
          }
        >
          {filtered ? "Nobody matches this search or filter." : "Nobody has signed up yet."}
        </EmptyBox>
      ) : (
        <ResponsiveTable
          caption={caption}
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          card={(r) => (
            <div data-row={r.id} className="grid gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <PersonCell person={r} heading>
                  {errorLine(r)}
                </PersonCell>
                <Chips row={r} />
              </div>
              <CardFacts
                facts={[
                  { term: "Signed up", value: formatIstDate(r.createdAt) },
                  { term: "Last active", value: lastActiveLabel(r.lastActiveAt, nowMs) },
                ]}
              />
              <div className="grid gap-0.5">
                <p className="type-label text-muted">Done</p>
                <p className="type-small">
                  <span className="type-num">{formatCount(r.done.total)}</span> · {doneLine(r.done)}
                </p>
              </div>
              {actions(r) && <div className="flex flex-wrap gap-2">{actions(r)}</div>}
            </div>
          )}
        />
      )}
      {nextOffset !== null && (
        <div className="grid justify-items-start gap-1">
          <button type="button" onClick={() => void loadMore()} disabled={loadingMore} aria-busy={loadingMore || undefined} className={cn(buttonStyles.secondary, "w-fit")}>
            {loadingMore && <Spinner />}
            Show 50 more
          </button>
          {moreError && <p className="type-small text-danger">{moreError}</p>}
        </div>
      )}
      {suspending && (
        <ConfirmDialog
          tone="danger"
          title={`Suspend ${suspending.name}?`}
          body="They're signed out at once and can't sign in until someone reactivates them. Their progress and notes are kept."
          confirmLabel="Suspend"
          pendingLabel="Suspending…"
          onConfirm={() => suspend(suspending)}
          onClose={() => setSuspending(null)}
        />
      )}
    </>
  );
}
