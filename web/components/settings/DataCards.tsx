"use client";

// Settings: "Your data" (download my data), "Claude export keys" and "Delete account"
// (design spec 5, /settings; M4-DESIGN 10.4 for the key card).
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { deleteMyAccount } from "@/app/actions/account";
import { createExportKey, downloadMyData, revokeExportKey } from "@/app/actions/settings";
import { formatIstDate, lastActiveLabel, usernameProblem } from "@/lib/admin-format";
import { CARD_STYLES, CardHead } from "../Card";
import { cn } from "../cn";
import { type ConfirmOutcome, ConfirmDialog } from "../Dialog";
import { CopyIcon, DownloadIcon, KeyIcon } from "../icons";
import { callAction, useActionFailure, useNotices } from "../notices";
import { InlineButton } from "../save/SaveLines";
import { useCanWrite, useSaveStatus } from "../save/SaveStatusProvider";
import { Spinner, buttonStyles } from "../ui";

const BODY = "grid justify-items-start gap-3 px-4 pb-4";
const TEXT = "type-small max-w-[34em] text-muted";

// ---- Your data

export function YourDataCard() {
  const titleId = useId();
  const failedId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const save = useSaveStatus();
  const canWrite = useCanWrite(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    setPending(true);
    setFailed(false);
    const result = await callAction(() => downloadMyData());
    setPending(false);
    if (result.ok) {
      const url = URL.createObjectURL(new Blob([result.value.json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = result.value.fileName;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    if (result.error.code === "signed-out") {
      save.markSignedOut();
      return;
    }
    setFailed(true);
  }

  return (
    <section aria-labelledby={titleId} className={CARD_STYLES}>
      <CardHead titleId={titleId} title="Your data" />
      <div className={BODY}>
        <p className={TEXT}>
          Download everything you&apos;ve saved: your GitHub profile details, ticks, notes, links, Weekly notes, section
          choices and activity history. It comes as a JSON file (a plain text format other apps can read).
        </p>
        <div className="grid gap-1">
          <button
            ref={button}
            type="button"
            onClick={() => void download()}
            disabled={!canWrite || pending}
            aria-busy={pending || undefined}
            className={cn(buttonStyles.secondary, "w-fit")}
          >
            <DownloadIcon size={18} className={cn("flex-none", pending && "motion-safe:hidden")} />
            {pending && <Spinner />}
            {pending ? "Preparing…" : "Download my data"}
          </button>
          {failed && (
            <p className="type-small text-danger">
              <span id={failedId}>Couldn&apos;t prepare your download.</span>{" "}
              <InlineButton
                describedBy={failedId}
                disabled={!canWrite}
                onClick={() => {
                  button.current?.focus();
                  void download();
                }}
              >
                Try again
              </InlineButton>
            </p>
          )}
        </div>
        <p className={TEXT}>
          Read what&apos;s stored and who can see it on the{" "}
          <Link href="/privacy" className="text-accent underline underline-offset-2">
            privacy page
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

// ---- Claude export keys

export interface ExportKey {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export function ExportKeysCard({ initial, nowMs }: { initial: ExportKey[]; nowMs: number }) {
  const titleId = useId();
  const createErrorId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  const save = useSaveStatus();
  const notices = useNotices();
  const failure = useActionFailure();
  const canWrite = useCanWrite(false);
  const [keys, setKeys] = useState(initial);
  const [fresh, setFresh] = useState<{ id: string; key: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<ExportKey | null>(null);

  async function create() {
    setPending(true);
    setCreateError(null);
    const result = await callAction(() => createExportKey());
    setPending(false);
    if (result.ok) {
      const { id, key, createdAt } = result.value;
      setKeys((list) => [...list, { id, createdAt, lastUsedAt: null }]);
      setFresh({ id, key });
      return;
    }
    if (result.error.code === "signed-out") {
      save.markSignedOut();
      return;
    }
    setCreateError(result.error.message);
  }

  async function revoke(key: ExportKey): Promise<ConfirmOutcome> {
    const result = await callAction(() => revokeExportKey(key.id));
    if (result.ok || result.error.code === "not-found") {
      const index = keys.findIndex((k) => k.id === key.id);
      const rest = keys.filter((k) => k.id !== key.id);
      setKeys(rest);
      if (fresh?.id === key.id) setFresh(null);
      notices.info("Key revoked. Anything using it can't read your data any more.");
      // The row goes: focus to the next key's Revoke, or the card's heading.
      requestAnimationFrame(() => {
        const next = rest[Math.min(index, rest.length - 1)];
        const target = next ? document.querySelector<HTMLElement>(`[data-revoke="${next.id}"]`) : heading.current;
        target?.focus();
      });
      return null;
    }
    return failure(result.error);
  }

  return (
    <section aria-labelledby={titleId} className={CARD_STYLES}>
      <div className="px-4 py-3.5">
        <h2 ref={heading} id={titleId} tabIndex={-1} className="type-title w-fit">
          Claude export keys
        </h2>
      </div>
      <div className={BODY}>
        <p className={TEXT}>
          A key lets a Claude session read your progress (ticks, notes, links and section choices) from the export
          address, and nothing else. Each key is shown once, so copy it when you create it. Revoke a key you no longer
          use.
        </p>
        {keys.length > 0 ? (
          <ul className="grid w-full">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line py-2 first:border-t-0">
                <KeyIcon size={18} className="flex-none text-muted" />
                <div className="min-w-0 flex-[1_1_180px]">
                  <p className="type-body-strong">Key created {formatIstDate(k.createdAt)}</p>
                  <p className="type-small text-muted">
                    {k.lastUsedAt ? `Last used ${lastUsedLabel(k.lastUsedAt, nowMs)}` : "Never used"}
                  </p>
                </div>
                <button
                  type="button"
                  data-revoke={k.id}
                  disabled={!canWrite}
                  onClick={() => setRevoking(k)}
                  className={buttonStyles.dangerSecondarySm}
                >
                  Revoke<span className="sr-only"> the key created {formatIstDate(k.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-small text-muted">No keys yet.</p>
        )}
        {fresh && (
          <NewKey
            value={fresh.key}
            onDone={() => {
              setFresh(null);
              requestAnimationFrame(() => createButton.current?.focus());
            }}
          />
        )}
        <div className="grid gap-1">
          <button
            ref={createButton}
            type="button"
            onClick={() => void create()}
            disabled={!canWrite || pending}
            aria-busy={pending || undefined}
            aria-describedby={createError ? createErrorId : undefined}
            className={cn(buttonStyles.secondary, "w-fit")}
          >
            <KeyIcon size={18} className={cn("flex-none", pending && "motion-safe:hidden")} />
            {pending && <Spinner />}
            {pending ? "Creating…" : "Create a key"}
          </button>
          {createError && (
            <p id={createErrorId} className="type-small text-danger">
              {createError}
            </p>
          )}
        </div>
      </div>
      {revoking && (
        <ConfirmDialog
          tone="danger"
          title="Revoke this key?"
          body={`The key created ${formatIstDate(revoking.createdAt)} stops working at once, so any Claude session using it can't read your data any more. This can't be undone.`}
          confirmLabel="Revoke"
          pendingLabel="Revoking…"
          onConfirm={() => revoke(revoking)}
          onClose={() => setRevoking(null)}
        />
      )}
    </section>
  );
}

const lastUsedLabel = (iso: string, nowMs: number) => {
  const label = lastActiveLabel(iso, nowMs);
  return label === "Today" || label === "Yesterday" ? label.toLowerCase() : `on ${label}`;
};

/** The new key, shown once, with Copy. The only place a key is ever rendered. */
function NewKey({ value, onDone }: { value: string; onDone(): void }) {
  const fieldId = useId();
  const noteId = useId();
  const field = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  // Shown once: focus goes to the key, so it is read out and ready to copy.
  useEffect(() => field.current?.focus(), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied("yes");
    } catch {
      field.current?.select();
      setCopied("failed");
    }
  }

  return (
    <div role="group" aria-labelledby={fieldId} className="grid w-full gap-2 rounded-md border border-line bg-sunk p-3">
      <label htmlFor={fieldId} className="type-body-strong">
        Your new key
      </label>
      <p id={noteId} className="type-small text-muted">
        Copy it now and keep it somewhere safe. It won&apos;t be shown again.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          ref={field}
          id={fieldId}
          type="text"
          readOnly
          value={value}
          aria-describedby={noteId}
          onFocus={(e) => e.target.select()}
          className="type-num h-11 min-w-0 flex-[1_1_220px] rounded-md border border-line-strong bg-surface px-3 text-ink"
        />
        <button type="button" onClick={() => void copy()} className={buttonStyles.secondary}>
          <CopyIcon size={18} className="flex-none" />
          {copied === "yes" ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={onDone} className={buttonStyles.ghost}>
          Done
        </button>
      </div>
      <p role="status" className="type-small text-muted empty:hidden">
        {copied === "yes" ? "Copied to the clipboard." : copied === "failed" ? "Couldn't copy. The key is selected: copy it yourself." : ""}
      </p>
    </div>
  );
}

// ---- Delete account

const DELETE_FAILED = "Couldn't delete your account. Nothing was deleted. Try again.";

export function DeleteAccountCard({ canDelete, githubLogin }: { canDelete: boolean; githubLogin: string | null }) {
  const titleId = useId();
  const save = useSaveStatus();
  const canWrite = useCanWrite(false);
  const [open, setOpen] = useState(false);

  async function remove(typed: string): Promise<ConfirmOutcome> {
    let result: Awaited<ReturnType<typeof deleteMyAccount>> | undefined;
    try {
      result = await deleteMyAccount(typed);
    } catch {
      return { error: DELETE_FAILED };
    }
    // Success signs out and opens /login?status=deleted: stay busy while the browser goes.
    if (!result) return new Promise<ConfirmOutcome>(() => {});
    if (result.ok) return null;
    if (result.error.code === "signed-out") {
      save.markSignedOut();
      return null;
    }
    if (result.error.code === "invalid") return { fieldError: result.error.message };
    return { error: result.error.code === "failed" ? DELETE_FAILED : result.error.message };
  }

  return (
    <section aria-labelledby={titleId} className={CARD_STYLES}>
      <CardHead titleId={titleId} title="Delete account" />
      <div className={BODY}>
        {canDelete ? (
          <>
            <p className={TEXT}>
              Deletes your account and everything in it: progress, notes, links, Weekly notes, settings and sign-ins. It
              can&apos;t be undone, so download your data first if you want a copy.
            </p>
            {githubLogin ? (
              <button type="button" disabled={!canWrite} onClick={() => setOpen(true)} className={buttonStyles.dangerSecondary}>
                Delete my account
              </button>
            ) : (
              <p className={TEXT}>To delete your account here, sign out and sign in again first.</p>
            )}
          </>
        ) : (
          <p className={TEXT}>The owner&apos;s account can&apos;t be deleted here.</p>
        )}
      </div>
      {open && githubLogin && (
        <ConfirmDialog
          tone="danger"
          title="Delete your account?"
          body="This deletes your progress, notes, links, Weekly notes, settings and sign-ins at once. It can't be undone."
          confirmLabel="Delete my account"
          pendingLabel="Deleting…"
          typed={{ expected: githubLogin, check: (value) => usernameProblem(value, githubLogin) }}
          onConfirm={remove}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}
