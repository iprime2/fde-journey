"use client";

// Admin Sign-up (design spec 5): the user cap, and the Scaler access code (M4-DESIGN 10.2).
// Raising the cap while people wait, or lowering it below the places taken, asks first.
import { useId, useState } from "react";
import { saveScalerAccessCode, saveUserCap } from "@/app/actions/admin";
import { USER_CAP_MAX, USER_CAP_MIN } from "@/lib/access-types";
import type { SignupSettings } from "@/lib/admin-db";
import { capChange, capSavedMessage, formatCount, formatIstDate, parseWholeNumber, people } from "@/lib/admin-format";
import { CARD_STYLES } from "../Card";
import { cn } from "../cn";
import { type ConfirmOutcome, ConfirmDialog } from "../Dialog";
import { callAction, useActionFailure, useNotices } from "../notices";
import { Facts } from "../PageHeader";
import { useCanWrite, useSaveStatus } from "../save/SaveStatusProvider";
import { Spinner, buttonStyles } from "../ui";

const FIELD = "type-input h-11 rounded-md border bg-surface px-3 text-ink disabled:opacity-50";
const CAP_ERROR = "Enter a whole number from 0 to 1,000.";

export function SignupView({ settings }: { settings: SignupSettings }) {
  return (
    <>
      <UserCapCard settings={settings} />
      <ScalerCodeCard set={settings.scalerCodeSet} updatedAt={settings.scalerCodeUpdatedAt} />
    </>
  );
}

function UserCapCard({ settings }: { settings: SignupSettings }) {
  const titleId = useId();
  const fieldId = useId();
  const hintId = useId();
  const errorId = useId();
  const notices = useNotices();
  const save = useSaveStatus();
  const failure = useActionFailure();
  const canWrite = useCanWrite(false);
  const [value, setValue] = useState(String(settings.cap));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [asking, setAsking] = useState<{ cap: number; kind: "raise" | "lower"; admits: number } | null>(null);
  // A fresh reading from the server (after saving) resets the field.
  const [source, setSource] = useState(settings);
  if (settings !== source) {
    setSource(settings);
    setValue(String(settings.cap));
  }
  const changed = value.trim() !== String(settings.cap);

  async function saveCap(cap: number): Promise<ConfirmOutcome> {
    const result = await callAction(() => saveUserCap(cap));
    if (!result.ok) return failure(result.error, { field: "cap" });
    notices.info(capSavedMessage(result.value.cap, result.value.admitted));
    return null;
  }

  async function submit() {
    const cap = parseWholeNumber(value, USER_CAP_MIN, USER_CAP_MAX);
    if (cap === null) {
      setError(CAP_ERROR);
      return;
    }
    setError(null);
    const change = capChange(settings.cap, cap, settings.taken, settings.waiting);
    if (change.kind !== "plain") {
      setAsking({ cap, kind: change.kind, admits: change.kind === "raise" ? change.admits : 0 });
      return;
    }
    setPending(true);
    const outcome = await saveCap(cap);
    setPending(false);
    if (outcome && "fieldError" in outcome) setError(outcome.fieldError);
    else if (outcome) setError(outcome.error);
    else if (!save.signedOut) setValue(String(cap));
  }

  return (
    <section aria-labelledby={titleId} className={cn(CARD_STYLES, "grid gap-3 px-4 py-3.5")}>
      <h2 id={titleId} className="type-title">
        User cap
      </h2>
      <Facts
        facts={[
          { label: "Places taken", value: formatCount(settings.taken) },
          { label: "Free", value: formatCount(settings.free) },
          { label: "Waiting", value: formatCount(settings.waiting) },
        ]}
      />
      <form
        className="grid gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor={fieldId} className="type-body-strong w-fit">
          User cap
        </label>
        <p id={hintId} className="type-small max-w-[34em] text-muted">
          How many people can have a place. The owner isn&apos;t counted. 0 stops new places; everyone new joins the
          waitlist.
        </p>
        <div className="flex flex-wrap items-start gap-2">
          <input
            id={fieldId}
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
            aria-invalid={error ? true : undefined}
            aria-describedby={cn(hintId, error && errorId) || undefined}
            className={cn(FIELD, "w-[120px]", error ? "border-danger" : "border-line-strong")}
          />
          <button type="submit" disabled={!canWrite || !changed || pending} aria-busy={pending || undefined} className={buttonStyles.primary}>
            {pending && <Spinner />}
            {pending ? "Saving…" : "Save cap"}
          </button>
        </div>
        {error && (
          <p id={errorId} className="type-small text-danger">
            {error}
          </p>
        )}
      </form>
      {asking && (
        <ConfirmDialog
          tone="primary"
          title={`${asking.kind === "raise" ? "Raise" : "Lower"} the cap to ${formatCount(asking.cap)}?`}
          body={
            asking.kind === "raise"
              ? `This lets in the next ${asking.admits === 1 ? "person" : people(asking.admits)} from the waitlist, in the order they joined.`
              : `${people(settings.taken)} already have places. Nobody loses theirs, but new sign-ups join the waitlist until fewer than ${formatCount(asking.cap)} people have places.`
          }
          confirmLabel={asking.kind === "raise" ? "Raise cap" : "Lower cap"}
          pendingLabel="Saving…"
          onConfirm={() => saveCap(asking.cap)}
          onClose={() => setAsking(null)}
        />
      )}
    </section>
  );
}

/** Sets or changes the Scaler access code. It is stored only as a hash and never shown again. */
function ScalerCodeCard({ set, updatedAt }: { set: boolean; updatedAt: string | null }) {
  const titleId = useId();
  const fieldId = useId();
  const hintId = useId();
  const errorId = useId();
  const notices = useNotices();
  const save = useSaveStatus();
  const canWrite = useCanWrite(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (value.trim().length < 6 || value.trim().length > 64) {
      setError("Use 6 to 64 letters, numbers or symbols.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await callAction(() => saveScalerAccessCode(value));
    setPending(false);
    if (result.ok) {
      setValue("");
      notices.info("Scaler access code saved. People who already unlocked Scaler keep it.");
      return;
    }
    if (result.error.code === "signed-out") {
      save.markSignedOut();
      return;
    }
    if (result.error.code === "forbidden") notices.error(result.error.message);
    else setError(result.error.message);
  }

  return (
    <section aria-labelledby={titleId} className={cn(CARD_STYLES, "grid gap-3 px-4 py-3.5")}>
      <h2 id={titleId} className="type-title">
        Scaler access code
      </h2>
      <p className="type-small max-w-[34em] text-muted">
        {set
          ? `A code is set${updatedAt ? ` (last changed ${formatIstDate(updatedAt)})` : ""}. Scaler learners enter it in their Settings to unlock the Scaler section.`
          : "No code is set yet, so nobody else can unlock the Scaler section."}
      </p>
      <form
        className="grid gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor={fieldId} className="type-body-strong w-fit">
          {set ? "New access code" : "Access code"}
        </label>
        <p id={hintId} className="type-small max-w-[34em] text-muted">
          6 to 64 letters, numbers or symbols; capitals don&apos;t matter. It&apos;s stored scrambled and can&apos;t be
          shown again. Changing it doesn&apos;t lock out anyone who already unlocked Scaler.
        </p>
        <div className="flex flex-wrap items-start gap-2">
          <input
            id={fieldId}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={64}
            disabled={pending}
            aria-invalid={error ? true : undefined}
            aria-describedby={cn(hintId, error && errorId) || undefined}
            className={cn(FIELD, "min-w-0 flex-[1_1_200px]", error ? "border-danger" : "border-line-strong")}
          />
          <button type="submit" disabled={!canWrite || pending || value.trim() === ""} aria-busy={pending || undefined} className={buttonStyles.secondary}>
            {pending && <Spinner />}
            {pending ? "Saving…" : "Save code"}
          </button>
        </div>
        {error && (
          <p id={errorId} className="type-small text-danger">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
