"use client";

// Dialog (design spec 4, v0.5): every confirmation. A native <dialog> opened with showModal(), so
// the page behind is inert, Tab stays inside and Escape works. Mount it only while it is open:
//
//   {target && <ConfirmDialog title="Suspend Sam Example?" … onConfirm={…} onClose={() => setTarget(null)} />}
//
// - Focus on open: the field if there is one; otherwise Cancel in destructive dialogs (a stray
//   Enter does nothing harmful) and the confirm button in the others.
// - Cancel and Escape close it and return focus to the button that opened it. A click on the
//   backdrop does nothing.
// - Pending: the confirm button shows its loading label, Cancel is disabled, Escape is ignored.
// - `onConfirm` returns null when it worked (the dialog closes), or a message to show above the
//   buttons (role="alert"; both buttons work again and focus stays on the confirm button), or a
//   field error for the typed field.
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "./cn";
import { Spinner, buttonStyles } from "./ui";

export type ConfirmOutcome = null | { error: string } | { fieldError: string };

export interface TypedConfirm {
  /** The username to type, shown in the label. */
  expected: string;
  /** Checked in the browser before anything is sent; the server checks again. */
  check(value: string): string | null;
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  pendingLabel,
  tone,
  typed,
  onConfirm,
  onClose,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  /** "danger" for destructive actions (delete, leave, suspend, remove, take away permissions). */
  tone: "danger" | "primary";
  /** Typed confirm (Delete my account only). */
  typed?: TypedConfirm;
  onConfirm(value: string): Promise<ConfirmOutcome>;
  /**
   * "cancel": focus is already back on the opener. "done": the action worked; focus is on the
   * opener if it is still on the page, and the caller may move it somewhere better.
   */
  onClose(reason: "cancel" | "done"): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const fieldId = useId();
  const fieldErrorId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && !d.contains(active)) opener.current = active;
    if (!d.open) d.showModal();
    (field.current ?? (tone === "danger" ? cancelButton.current : confirmButton.current))?.focus();
    return () => {
      if (d.open) d.close();
    };
  }, [tone]);

  function returnFocus() {
    const target = opener.current;
    if (target?.isConnected) target.focus();
  }

  function cancel() {
    if (pending) return;
    dialog.current?.close();
    returnFocus();
    onClose("cancel");
  }

  async function confirm() {
    if (pending) return;
    if (typed) {
      const problem = typed.check(value);
      if (problem) {
        setFieldError(problem);
        setError(null);
        field.current?.focus();
        return;
      }
    }
    setPending(true);
    setError(null);
    setFieldError(null);
    let outcome: ConfirmOutcome;
    try {
      outcome = await onConfirm(value);
    } catch {
      outcome = { error: "That didn't work, and nothing was changed. Try again." };
    }
    setPending(false);
    if (outcome === null) {
      dialog.current?.close();
      returnFocus();
      onClose("done");
      return;
    }
    if ("fieldError" in outcome) {
      setFieldError(outcome.fieldError);
      // Wait for the field to be enabled again before focusing it.
      requestAnimationFrame(() => field.current?.focus());
    } else {
      setError(outcome.error);
      requestAnimationFrame(() => confirmButton.current?.focus());
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(e) => {
        // Escape: closes, except while the action is on its way.
        e.preventDefault();
        cancel();
      }}
      className={cn(
        "dialog m-auto max-h-[calc(100dvh-32px)] w-[min(440px,calc(100%-32px))] max-w-none overflow-y-auto rounded-lg border border-line bg-surface p-5 text-ink shadow-overlay md:p-6",
        // Typed confirm below 768 px sits at the top, so the keyboard never covers the field.
        typed && "max-md:mt-[max(16px,env(safe-area-inset-top))]",
      )}
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void confirm();
        }}
      >
        <h2 id={titleId} className="type-title [overflow-wrap:anywhere]">
          {title}
        </h2>
        <div id={bodyId} className="type-body [overflow-wrap:anywhere]">
          {body}
        </div>
        {typed && (
          <div className="grid gap-1.5">
            <label htmlFor={fieldId} className="type-body">
              To confirm, type your GitHub username:{" "}
              <b className="type-num whitespace-nowrap text-[15px] text-ink">{typed.expected}</b>
            </label>
            <input
              ref={field}
              id={fieldId}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={pending}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? fieldErrorId : undefined}
              className={cn(
                "type-input h-11 w-full rounded-md border bg-surface px-3 text-ink",
                fieldError ? "border-danger" : "border-line-strong",
              )}
            />
            {fieldError && (
              <p id={fieldErrorId} className="type-small text-danger">
                <NoBreak text={fieldError} word={typed.expected} />
              </p>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="type-small rounded-md bg-danger-soft px-3.5 py-2.5 text-danger">
            {error}
          </p>
        )}
        <div className="grid gap-2 md:flex md:justify-end">
          <button ref={cancelButton} type="button" onClick={cancel} disabled={pending} className={cn(buttonStyles.secondary, "w-full md:w-auto")}>
            Cancel
          </button>
          <button
            ref={confirmButton}
            type="submit"
            disabled={pending}
            aria-busy={pending || undefined}
            className={cn(tone === "danger" ? buttonStyles.danger : buttonStyles.primary, "w-full md:w-auto")}
          >
            {pending && <Spinner />}
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/** `text` with every `word` in it kept on one line (a username must not break at its hyphen). */
function NoBreak({ text, word }: { text: string; word: string }) {
  if (!word || !text.includes(word)) return text;
  const parts = text.split(word);
  return parts.map((part, i) => (
    <span key={i}>
      {part}
      {i < parts.length - 1 && <span className="whitespace-nowrap">{word}</span>}
    </span>
  ));
}
