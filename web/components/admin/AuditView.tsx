"use client";

// Admin Audit log (design spec 5): a "Show" filter, then the actions, newest first, 50 at a time.
// One plain sentence each, naming the person by @username. Never a note, link or email.
import { useState } from "react";
import { loadMoreAudit } from "@/app/actions/admin";
import type { AuditEntry, AuditPage } from "@/lib/admin-db";
import { type SentencePart, auditSentence, formatCount, formatIstDateTime } from "@/lib/admin-format";
import { cn } from "../cn";
import { callAction, useNotices } from "../notices";
import { useSaveStatus } from "../save/SaveStatusProvider";
import { Spinner, buttonStyles } from "../ui";
import { AdminToolbar } from "./AdminToolbar";
import { type Column, EmptyBox, ResponsiveTable, focusVisible } from "./ResponsiveTable";

const FILTER_OPTIONS = [
  { value: "all", label: "All actions" },
  { value: "let-in", label: "Let in" },
  { value: "removed-from-waitlist", label: "Removed from waitlist" },
  { value: "suspended", label: "Suspended" },
  { value: "reactivated", label: "Reactivated" },
  { value: "cap-changed", label: "Cap changed" },
  { value: "permissions-changed", label: "Permissions changed" },
] as const;

function Sentence({ parts }: { parts: SentencePart[] }) {
  return (
    <>
      {parts.map((p, i) => (typeof p === "string" ? <span key={i}>{p}</span> : <span key={i} className="whitespace-nowrap">@{p.login}</span>))}
    </>
  );
}

/** The admin who acted: name and @username, no avatar (dense). */
function Who({ entry }: { entry: AuditEntry }) {
  if (!entry.actor) return <span className="text-muted">a deleted account</span>;
  return (
    <span className="grid">
      <span className="[overflow-wrap:anywhere]">{entry.actor.name}</span>
      {entry.actor.githubLogin && <span className="type-small whitespace-nowrap text-muted">@{entry.actor.githubLogin}</span>}
    </span>
  );
}

export function AuditView({ page, filter }: { page: AuditPage; filter: string }) {
  const notices = useNotices();
  const save = useSaveStatus();
  const [show, setShow] = useState(filter);
  const [source, setSource] = useState(page);
  const [rows, setRows] = useState(page.rows);
  const [nextOffset, setNextOffset] = useState(page.nextOffset);
  if (page !== source) {
    setSource(page);
    setRows(page.rows);
    setNextOffset(page.nextOffset);
  }
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (nextOffset === null) return;
    setLoading(true);
    const result = await callAction(() => loadMoreAudit(filter, nextOffset));
    setLoading(false);
    if (!result.ok) {
      if (result.error.code === "signed-out") save.markSignedOut();
      else notices.error(result.error.message);
      return;
    }
    const firstNew = result.value.rows[0]?.id;
    setRows((list) => [...list, ...result.value.rows.filter((r) => !list.some((x) => x.id === r.id))]);
    setNextOffset(result.value.nextOffset);
    if (firstNew !== undefined) requestAnimationFrame(() => focusVisible(`[data-entry="${firstNew}"]`));
  }

  const columns: Column<AuditEntry>[] = [
    {
      key: "when",
      header: "When",
      className: "w-[230px]",
      cell: (e) => (
        <span data-entry={e.id} tabIndex={-1} className="type-num">
          {formatIstDateTime(e.at)}
        </span>
      ),
    },
    { key: "who", header: "Who", className: "w-[220px]", cell: (e) => <Who entry={e} /> },
    { key: "what", header: "What", cell: (e) => <Sentence parts={auditSentence(e)} /> },
  ];

  return (
    <>
      <AdminToolbar
        path="/admin/audit"
        param="action"
        state={{ q: "", show }}
        options={FILTER_OPTIONS}
        placeholder={null}
        announcement={`${formatCount(page.rows.length)}${page.nextOffset !== null ? " or more" : ""} ${page.rows.length === 1 ? "action" : "actions"} shown`}
        onChange={(next) => setShow(next.show)}
      />
      {rows.length === 0 ? (
        <EmptyBox>No admin actions yet.</EmptyBox>
      ) : (
        <ResponsiveTable
          caption="Admin actions, newest first."
          columns={columns}
          rows={rows}
          rowKey={(e) => String(e.id)}
          card={(e) => (
            <>
              <p data-entry={e.id} tabIndex={-1} className="type-body">
                <Sentence parts={auditSentence(e)} />
              </p>
              <p className="type-small text-muted">
                {e.actor ? e.actor.name : "a deleted account"} · <span className="type-num">{formatIstDateTime(e.at)}</span>
              </p>
            </>
          )}
        />
      )}
      {nextOffset !== null && (
        <button type="button" onClick={() => void loadMore()} disabled={loading} aria-busy={loading || undefined} className={cn(buttonStyles.secondary, "w-fit")}>
          {loading && <Spinner />}
          Show 50 more
        </button>
      )}
    </>
  );
}
