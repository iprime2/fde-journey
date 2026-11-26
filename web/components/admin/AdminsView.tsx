"use client";

// Admin Admins (design spec 5): add an admin, the owner's locked card, then one card per admin
// with seven permission checkboxes, "Save changes" and "Remove as admin". Cards at every width.
import { useId, useRef, useState } from "react";
import { findUserForAdmin, removeAdmin, saveAdminPermissions } from "@/app/actions/admin";
import { PERMISSIONS, type Permission, SUPER_ADMIN_ONLY, withImpliedPermissions } from "@/lib/access-types";
import type { AdminEntry, AdminList, AdminPerson, FoundPerson } from "@/lib/admin-db";
import { IMPLIED_DESCRIPTION, PERMISSION_COPY, permissionDiff, permissionDiffText, permissionLabels } from "@/lib/admin-format";
import { CARD_STYLES } from "../Card";
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
  const notices = useNotices();
  const save = useSaveStatus();
  const failure = useActionFailure();
  const canWrite = useCanWrite(false);
  const [login, setLogin] = useState("");
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<AdminPerson | null>(null);
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
    setPicked([]);
    const result = await callAction(() => findUserForAdmin(login));
    setFinding(false);
    if (!result.ok) {
      if (result.error.code === "signed-out") save.markSignedOut();
      else if (result.error.code === "forbidden") notices.error(result.error.message);
      else setError(result.error.message);
      return;
    }
    const person: FoundPerson = result.value;
    let problem: string | null = null;
    if (!person) problem = NOT_FOUND;
    else if (person.status !== "active") problem = "Only people with a place can be admins.";
    else if (person.isOwner) problem = "That's the owner, who has every permission already.";
    else if (person.permissions.length > 0) problem = `${person.name} is already an admin. Change their permissions below.`;
    if (problem || !person) {
      setError(problem ?? NOT_FOUND);
      field.current?.focus();
      return;
    }
    setFound(person);
  }

  async function make(): Promise<ConfirmOutcome> {
    if (!found) return null;
    const result = await callAction(() => saveAdminPermissions(found.id, picked));
    if (!result.ok) return failure(result.error);
    notices.info(`${found.name} is now an admin.`);
    onAdded({ ...found, permissions: result.value.permissions });
    setFound(null);
    setPicked([]);
    setLogin("");
    requestAnimationFrame(() => field.current?.focus());
    return null;
  }

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
      {found && (
        <div className="grid gap-3 border-t border-line pt-3">
          <PersonCell person={found} heading />
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
