"use client";

// Admin Admins (design spec 5): add an admin, the owner's locked card, then one card per admin
// with seven permission checkboxes, "Save changes" and "Remove as admin". Cards at every width.
import { useId, useRef, useState } from "react";
import { findUserForAdmin, removeAdmin, saveAdminPermissions } from "@/app/actions/admin";
import { PERMISSIONS, type Permission, SUPER_ADMIN_ONLY, withImpliedPermissions } from "@/lib/access-types";
import type { AdminEntry, AdminList, FoundPerson } from "@/lib/admin-db";
import { IMPLIED_DESCRIPTION, PERMISSION_COPY, formatIstDate, lastActiveLabel, permissionDiff, permissionDiffText, permissionLabels } from "@/lib/admin-format";
import { CARD_STYLES } from "../Card";
import { Avatar } from "../account/Avatar";
import { cn } from "../cn";
import { type ConfirmOutcome, ConfirmDialog } from "../Dialog";
import { CheckIcon, LockIcon } from "../icons";
import { callAction, useActionFailure, useNotices } from "../notices";
import { useCanWrite, useSaveStatus } from "../save/SaveStatusProvider";
import { Spinner, StatusChip, buttonStyles } from "../ui";
import { PersonCell } from "./Person";

export function AdminsView({ list, isSuperAdmin, meId }: { list: AdminList; isSuperAdmin: boolean; meId: string }) {
  const addHeading = useRef<HTMLHeadingElement>(null);
  const [source, setSource] = useState(list);
  const [admins, setAdmins] = useState(list.admins);
  if (list !== source) {
    setSource(list);
    setAdmins(list.admins);
  }
  // "Manage admins" is shown only to the owner (design spec 5).
  const shown = PERMISSIONS.filter((p) => isSuperAdmin || p !== SUPER_ADMIN_ONLY);

  function removed(id: string) {
    const index = admins.findIndex((a) => a.id === id);
    const rest = admins.filter((a) => a.id !== id);
    setAdmins(rest);
    const next = rest[Math.min(index, rest.length - 1)];
    requestAnimationFrame(() => {
      const box = next ? document.querySelector<HTMLElement>(`[data-admin="${next.id}"] input[type="checkbox"]:not(:disabled)`) : null;
      (box ?? addHeading.current)?.focus();
    });
  }

  return (
    <>
      <AddAdmin
        headingRef={addHeading}
        shown={shown}
        onAdded={(entry) => setAdmins((list) => [...list.filter((a) => a.id !== entry.id), entry])}
      />
      {list.owner && (
        <section aria-label={`${list.owner.name}, owner`} className={cn(CARD_STYLES, "grid gap-3 px-4 py-3.5")}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <PersonCell person={list.owner} heading />
            <StatusChip chip={{ label: "Owner", variant: "now" }} />
          </div>
          <p className="type-small flex items-center gap-2 text-muted">
            <LockIcon size={16} className="flex-none" />
            Has every permission. This can&apos;t be changed here.
          </p>
        </section>
      )}
      {admins.length === 0 ? (
        <p className="type-small text-muted">No other admins yet.</p>
      ) : (
        admins.map((admin) => (
          <AdminCard key={admin.id} admin={admin} shown={shown} isMe={admin.id === meId} onRemoved={() => removed(admin.id)} />
        ))
      )}
    </>
  );
}

/** The seven checkboxes (the 44 px tick cell from ItemRow). Ticking "Suspend and reactivate users" also ticks and locks "See users". */
function PermissionBoxes({
  shown,
  value,
  disabled,
  onChange,
}: {
  shown: readonly Permission[];
  value: readonly Permission[];
  disabled: boolean;
  onChange(next: Permission[]): void;
}) {
  const baseId = useId();
  const implied = value.includes("users.manage");
  return (
    <ul className="grid gap-x-4 md:grid-cols-2">
      {shown.map((p) => {
        const id = `${baseId}-${p}`;
        const locked = p === "users.view" && implied;
        const checked = value.includes(p) || locked;
        return (
          <li key={p}>
            <label htmlFor={id} className={cn("grid grid-cols-[44px_minmax(0,1fr)] items-start", !disabled && !locked && "cursor-pointer")}>
              <span className="relative grid size-11 place-items-center">
                <input
                  id={id}
                  type="checkbox"
                  className="tick peer"
                  checked={checked}
                  disabled={disabled || locked}
                  aria-describedby={`${id}-d`}
                  onChange={(e) => onChange(withImpliedPermissions(e.target.checked ? [...value, p] : value.filter((x) => x !== p)))}
                />
                <CheckIcon size={14} className="pointer-events-none absolute hidden text-accent-ink peer-checked:block" />
              </span>
              <span className="grid py-2.5">
                <span className="type-body-strong">{PERMISSION_COPY[p].label}</span>
                <span id={`${id}-d`} className="type-small text-muted">
                  {locked ? IMPLIED_DESCRIPTION : PERMISSION_COPY[p].description}
                </span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function AdminCard({ admin, shown, isMe, onRemoved }: { admin: AdminEntry; shown: readonly Permission[]; isMe: boolean; onRemoved(): void }) {
  const notices = useNotices();
  const failure = useActionFailure();
  const canWrite = useCanWrite(false);
  const [saved, setSaved] = useState(admin.permissions);
  const [value, setValue] = useState(admin.permissions);
  const [source, setSource] = useState(admin);
  if (admin !== source) {
    setSource(admin);
    setSaved(admin.permissions);
    setValue(admin.permissions);
  }
  const [dialog, setDialog] = useState<"save" | "remove" | null>(null);
  const changed = permissionDiff(saved, value);
  const hasChanges = changed.give.length > 0 || changed.take.length > 0;
  // Your own permissions can't be changed here (the server refuses too).
  const locked = isMe || !canWrite;

  async function saveChanges(): Promise<ConfirmOutcome> {
    const result = await callAction(() => saveAdminPermissions(admin.id, value));
    if (!result.ok) return failure(result.error);
    if (result.value.permissions.length === 0) {
      notices.info(`${admin.name} is no longer an admin.`);
      onRemoved();
    } else {
      setSaved(result.value.permissions);
      setValue(result.value.permissions);
      notices.info(`${admin.name}'s permissions are saved.`);
    }
    return null;
  }

  async function remove(): Promise<ConfirmOutcome> {
    const result = await callAction(() => removeAdmin(admin.id));
    if (!result.ok) return failure(result.error);
    notices.info(`${admin.name} is no longer an admin.`);
    onRemoved();
    return null;
  }

  return (
    <section data-admin={admin.id} aria-label={`${admin.name}, admin`} className={cn(CARD_STYLES, "grid gap-3 px-4 py-3.5")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PersonCell person={admin} heading />
        <StatusChip chip={{ label: "Admin", variant: "neutral" }} />
      </div>
      <fieldset className="min-w-0">
        <legend className="sr-only">Permissions for {admin.name}</legend>
        <PermissionBoxes shown={shown} value={value} disabled={locked} onChange={setValue} />
      </fieldset>
      {isMe ? (
        <p className="type-small text-muted">You can&apos;t change your own permissions.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!canWrite || !hasChanges} onClick={() => setDialog("save")} className={buttonStyles.primary}>
            Save changes
          </button>
          <button type="button" disabled={!canWrite} onClick={() => setDialog("remove")} className={buttonStyles.dangerSecondary}>
            Remove as admin<span className="sr-only">: {admin.name}</span>
          </button>
        </div>
      )}
      {dialog === "save" && (
        <ConfirmDialog
          tone={changed.take.length > 0 ? "danger" : "primary"}
          title={`Change ${admin.name}'s permissions?`}
          body={value.length === 0 ? "They lose every admin permission at once. Their own tracker isn't affected." : permissionDiffText(saved, value)}
          confirmLabel="Save changes"
          pendingLabel="Saving…"
          onConfirm={saveChanges}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "remove" && (
        <ConfirmDialog
          tone="danger"
          title={`Remove ${admin.name} as an admin?`}
          body="They lose every admin permission at once. Their own tracker isn't affected."
          confirmLabel="Remove as admin"
          pendingLabel="Removing…"
          onConfirm={remove}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}

const NOT_FOUND = "No active user has that username.";

/** "Signed up 26 Aug 2026 · Last active 3 Dec": tells apart people who share a username. */
const datesLine = (p: FoundPerson, nowMs: number) => `Signed up ${formatIstDate(p.createdAt)} · Last active ${lastActiveLabel(p.lastActiveAt, nowMs)}`;

/** Most recently active first (never active last), then newest sign-up. */
const byLastActive = (a: FoundPerson, b: FoundPerson) =>
  (b.lastActiveAt ? Date.parse(b.lastActiveAt) : -Infinity) - (a.lastActiveAt ? Date.parse(a.lastActiveAt) : -Infinity) ||
  Date.parse(b.createdAt) - Date.parse(a.createdAt);

/** Why someone found can't be made an admin (design spec 8, "other Find answers"). */
function findProblem(person: FoundPerson | undefined): string {
  if (!person) return NOT_FOUND;
  if (person.isOwner) return "That's the owner, who already has every permission.";
  if (person.status === "waitlisted") return `${person.name} is on the waitlist. Only people with a place can be admins.`;
  if (person.status === "suspended") return `${person.name} is suspended. Only people with a place can be admins.`;
  if (person.permissions.length > 0) return `${person.name} is already an admin. Change their permissions below.`;
  return NOT_FOUND;
}

function AddAdmin({
  headingRef,
  shown,
  onAdded,
}: {
  headingRef: React.Ref<HTMLHeadingElement>;
  shown: readonly Permission[];
  onAdded(entry: AdminEntry): void;
}) {
  const titleId = useId();
  const fieldId = useId();
  const errorId = useId();
  const field = useRef<HTMLInputElement>(null);
  const chooser = useRef<HTMLUListElement>(null);
  const foundArea = useRef<HTMLDivElement>(null);
  const notices = useNotices();
  const save = useSaveStatus();
  const failure = useActionFailure();
  const canWrite = useCanWrite(false);
  const [login, setLogin] = useState("");
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<FoundPerson | null>(null);
  // Several eligible people share the username (one renamed on GitHub and hasn't signed in since):
  // the admin chooses one. Kept after choosing, for "Choose someone else".
  const [choices, setChoices] = useState<FoundPerson[]>([]);
  const [nowMs, setNowMs] = useState(0);
  const [picked, setPicked] = useState<Permission[]>([]);
  const [asking, setAsking] = useState(false);

  async function find() {
    if (login.trim() === "") {
      setError("Type a GitHub username.");
      field.current?.focus();
      return;
    }
    setFinding(true);
    setError(null);
    setFound(null);
    setChoices([]);
    setPicked([]);
    const result = await callAction(() => findUserForAdmin(login));
    setFinding(false);
    if (!result.ok) {
      if (result.error.code === "signed-out") save.markSignedOut();
      else if (result.error.code === "forbidden") notices.error(result.error.message);
      else setError(result.error.message);
      return;
    }
    setNowMs(Date.now());
    const matches: FoundPerson[] = result.value;
    const eligible = matches.filter((p) => p.status === "active" && !p.isOwner && p.permissions.length === 0);
    if (eligible.length > 1) {
      setChoices([...eligible].sort(byLastActive));
      return;
    }
    if (eligible.length === 1) {
      setFound(eligible[0]);
      return;
    }
    // Nobody eligible: explain using the newest match.
    setError(findProblem(matches[0]));
    field.current?.focus();
  }

  function choose(person: FoundPerson) {
    setFound(person);
    setPicked([]);
    // The Choose button goes with the list: focus moves to the first permission (design spec 5).
    requestAnimationFrame(() => foundArea.current?.querySelector<HTMLElement>('input[type="checkbox"]:not(:disabled)')?.focus());
  }

  function chooseAgain() {
    setFound(null);
    setPicked([]);
    requestAnimationFrame(() => chooser.current?.querySelector<HTMLElement>("button")?.focus());
  }

  async function make(): Promise<ConfirmOutcome> {
    if (!found) return null;
    const result = await callAction(() => saveAdminPermissions(found.id, picked));
    if (!result.ok) return failure(result.error);
    notices.info(`${found.name} is now an admin.`);
    onAdded({ ...found, permissions: result.value.permissions });
    setFound(null);
    setChoices([]);
    setPicked([]);
    setLogin("");
    requestAnimationFrame(() => field.current?.focus());
    return null;
  }

  const shared = choices.length > 1;

  return (
    <section aria-labelledby={titleId} className={cn(CARD_STYLES, "grid gap-3 px-4 py-3.5")}>
      <h2 ref={headingRef} id={titleId} tabIndex={-1} className="type-title w-fit">
        Add an admin
      </h2>
      <form
        className="grid gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void find();
        }}
      >
        <label htmlFor={fieldId} className="type-body-strong w-fit">
          GitHub username
        </label>
        <div className="flex flex-wrap items-start gap-2">
          <input
            ref={field}
            id={fieldId}
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={40}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn("type-input h-11 min-w-0 flex-[1_1_200px] rounded-md border bg-surface px-3 text-ink", error ? "border-danger" : "border-line-strong")}
          />
          <button type="submit" disabled={!canWrite || finding} aria-busy={finding || undefined} className={buttonStyles.secondary}>
            {finding && <Spinner />}
            Find
          </button>
        </div>
        {error && (
          <p id={errorId} className="type-small text-danger">
            {error}
          </p>
        )}
      </form>
      {shared && !found && (
        <div className="grid gap-2 border-t border-line pt-3">
          <p className="type-small max-w-[34em] text-muted">
            {choices.length} people have this username. One of them changed it on GitHub and hasn&apos;t signed in since.
            The one who was active most recently probably holds it now.
          </p>
          <ul ref={chooser} className="grid">
            {choices.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line py-2.5 first:border-t-0">
                <Avatar initials={c.initials} src={c.avatar} className="self-start" />
                <div className="grid min-w-0 flex-[1_1_200px]">
                  <span className="type-body-strong [overflow-wrap:anywhere]">{c.name}</span>
                  {/* Plain text: the profile belongs to whoever holds the name today. */}
                  {c.githubLogin && <span className="type-small text-muted [overflow-wrap:anywhere]">@{c.githubLogin}</span>}
                  <span className="type-small text-muted">{datesLine(c, nowMs)}</span>
                </div>
                <button
                  type="button"
                  disabled={!canWrite}
                  aria-label={`Choose ${c.name}, signed up ${formatIstDate(c.createdAt)}`}
                  onClick={() => choose(c)}
                  className={buttonStyles.secondarySm}
                >
                  Choose
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {found && (
        <div ref={foundArea} className="grid gap-3 border-t border-line pt-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <PersonCell person={found} heading>
              {shared && <span className="type-small text-muted">{datesLine(found, nowMs)}</span>}
            </PersonCell>
            {shared && (
              <button type="button" onClick={chooseAgain} className={buttonStyles.ghostSm}>
                Choose someone else
              </button>
            )}
          </div>
          <fieldset className="min-w-0">
            <legend className="sr-only">Permissions for {found.name}</legend>
            <PermissionBoxes shown={shown} value={picked} disabled={!canWrite} onChange={setPicked} />
          </fieldset>
          <button type="button" disabled={!canWrite || picked.length === 0} onClick={() => setAsking(true)} className={cn(buttonStyles.primary, "w-fit")}>
            Make admin
          </button>
        </div>
      )}
      {asking && found && (
        <ConfirmDialog
          tone="primary"
          title={`Make ${found.name} an admin?`}
          body={`They can: ${permissionLabels(withImpliedPermissions(picked))}.`}
          confirmLabel="Make admin"
          pendingLabel="Saving…"
          onConfirm={make}
          onClose={() => setAsking(false)}
        />
      )}
    </section>
  );
}
