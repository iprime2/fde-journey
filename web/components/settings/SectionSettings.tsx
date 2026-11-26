"use client";

// Settings: the Sections card (design spec 5, /settings) and, until Scaler is unlocked, the
// "Unlock Scaler course" access-code card (M4-DESIGN 10.2). They share one state: entering the code
// unlocks Scaler and turns it on, so its switch changes too.
//
// Switches save like ticks: they change at once; a failed save puts the switch back and shows
// "Couldn't save this change." with Try again (focus to the switch first). Offline or signed out,
// they are disabled. Each change refreshes the navigation (the actions revalidate the layout).
import { Fragment, useEffect, useId, useRef, useState } from "react";
import { setSectionVisible, unlockScalerSection } from "@/app/actions/settings";
import { type SectionChoices, SWITCHABLE_SECTIONS, type SwitchableSection } from "@/lib/access-types";
import { SECTION_LABELS } from "@/lib/nav";
import { CARD_STYLES, CardHead } from "../Card";
import { cn } from "../cn";
import { callAction, useNotices } from "../notices";
import { InlineButton } from "../save/SaveLines";
import { useCanWrite, useSaveStatus } from "../save/SaveStatusProvider";
import { LockIcon } from "../icons";
import { Switch } from "../Switch";
import { Spinner, buttonStyles } from "../ui";

const DESCRIPTIONS: Record<keyof SectionChoices, string> = {
  roadmap: "Phases, tasks and learning resources.",
  reading: "Research papers and books.",
  scaler: "Classes for the Scaler course. Turn on if you're taking it.",
  certs: "Certifications in a suggested order.",
  projects: "Three portfolio projects, step by step.",
  career: "Career milestones and your Weekly notes.",
};

const SCALER_LOCKED = "Enter your access code below to unlock it.";

/**
 * Courses & badges is always on and isn't a section setting (no switch, nothing saved), but it is
 * in the menu and on Home, so it gets a locked row like Roadmap's (design spec 5, /settings, v0.7),
 * between Certifications and Projects.
 */
const COURSES_ROW = { label: "Courses & badges", description: "Courses from OpenAI and Anthropic, by roadmap phase." };
const COURSES_AFTER: SwitchableSection = "certs";

/** A section that can't be switched off: no switch, and "Always on" in the right column. */
function AlwaysOnRow({ label, description }: { label: string; description: string }) {
  return (
    <li className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 border-t border-line px-4 py-2.5">
      <div className="grid gap-0.5 py-0.5">
        <span className="type-body-strong">{label}</span>
        <span className="type-small max-w-[34em] text-muted">{description}</span>
      </div>
      <span className="type-small -my-2.5 flex min-h-11 items-center text-muted">Always on</span>
    </li>
  );
}

export function SectionSettings({ initial, scalerUnlocked: initialUnlocked }: { initial: SectionChoices; scalerUnlocked: boolean }) {
  const [sections, setSections] = useState(initial);
  const [scalerUnlocked, setScalerUnlocked] = useState(initialUnlocked);
  const scalerSwitch = useRef<HTMLInputElement>(null);
  // After unlocking, focus moves to the switch once React has rendered it, not in the next frame:
  // on a slow device the frame can come first, and the switch isn't there yet.
  const focusScalerAfterRender = useRef(false);
  useEffect(() => {
    if (!scalerUnlocked || !focusScalerAfterRender.current) return;
    focusScalerAfterRender.current = false;
    scalerSwitch.current?.focus();
  }, [scalerUnlocked]);
  const titleId = useId();

  return (
    <>
      <section aria-labelledby={titleId} className={CARD_STYLES}>
        <CardHead
          titleId={titleId}
          title="Sections"
          sub="Choose what shows in your menu and on Home. Hidden sections keep their progress, so you can turn them back on any time."
        />
        <ul>
          <AlwaysOnRow label={SECTION_LABELS.roadmap} description={DESCRIPTIONS.roadmap} />
          {SWITCHABLE_SECTIONS.map((section) => (
            <Fragment key={section}>
              <SectionRow
                section={section}
                on={sections[section]}
                locked={section === "scaler" && !scalerUnlocked}
                inputRef={section === "scaler" ? scalerSwitch : undefined}
                onSaved={setSections}
              />
              {section === COURSES_AFTER && <AlwaysOnRow {...COURSES_ROW} />}
            </Fragment>
          ))}
        </ul>
      </section>
      {!scalerUnlocked && (
        <ScalerCodeCard
          onUnlocked={(next) => {
            setSections(next);
            // The card goes; focus moves to the switch it just turned on (see focusScalerAfterRender).
            focusScalerAfterRender.current = true;
            setScalerUnlocked(true);
          }}
        />
      )}
    </>
  );
}

function SectionRow({
  section,
  on,
  locked,
  inputRef,
  onSaved,
}: {
  section: SwitchableSection;
  on: boolean;
  locked: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onSaved(next: SectionChoices): void;
}) {
  const inputId = useId();
  const descriptionId = useId();
  const failedId = useId();
  const ownRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? ownRef;
  const save = useSaveStatus();
  const canWrite = useCanWrite(false);
  // What the switch shows: the saved value, or the change on its way.
  const [shown, setShown] = useState<boolean | null>(null);
  const [failedTarget, setFailedTarget] = useState<boolean | null>(null);
  const checked = shown ?? on;
  const failureKey = `section:${section}`;

  async function change(next: boolean) {
    setShown(next);
    setFailedTarget(null);
    const result = await callAction(() => setSectionVisible(section, next));
    setShown(null);
    if (result.ok) {
      save.clearFailure(failureKey);
      onSaved(result.value);
      return;
    }
    if (result.error.code === "signed-out") {
      save.markSignedOut();
      return;
    }
    setFailedTarget(next);
    save.reportFailure(failureKey);
  }

  // Locked by code (design spec 4, Switch, v0.6): no switch at all, not a disabled one; the right
  // column says "Locked" and the line under the description says what to do.
  if (locked) {
    return (
      <li className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 border-t border-line px-4 py-2.5">
        <div className="grid gap-0.5 py-0.5">
          <span className="type-body-strong">{SECTION_LABELS[section]}</span>
          <span className="type-small max-w-[34em] text-muted">{DESCRIPTIONS[section]}</span>
          <span className="type-small max-w-[34em] text-muted">{SCALER_LOCKED}</span>
        </div>
        <span className="type-small -my-2.5 flex min-h-11 items-center gap-1.5 text-muted">
          <LockIcon size={16} className="flex-none" />
          Locked
        </span>
      </li>
    );
  }

  return (
    <li className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 border-t border-line px-4 py-2.5">
      <div className="grid gap-0.5 py-0.5">
        <label htmlFor={inputId} className="type-body-strong w-fit cursor-pointer">
          {SECTION_LABELS[section]}
        </label>
        <span id={descriptionId} className="type-small max-w-[34em] text-muted">
          {DESCRIPTIONS[section]}
        </span>
        {failedTarget !== null && (
          <p className="type-small text-danger">
            <span id={failedId}>Couldn&apos;t save this change.</span>{" "}
            <InlineButton
              describedBy={failedId}
              disabled={!canWrite}
              onClick={() => {
                // The line goes once the change saves, so focus moves to the switch first.
                ref.current?.focus();
                void change(failedTarget);
              }}
            >
              Try again
            </InlineButton>
          </p>
        )}
      </div>
      <span className="-my-2.5">
        <Switch
          id={inputId}
          inputRef={ref}
          checked={checked}
          disabled={!canWrite}
          describedBy={descriptionId}
          onChange={(next) => void change(next)}
        />
      </span>
    </li>
  );
}

const CODE_FAILED = "Couldn't check the code. Check your connection and try again.";

/** Unlocks Scaler with the access code. Five tries an hour; the server counts them. */
function ScalerCodeCard({ onUnlocked }: { onUnlocked(next: SectionChoices): void }) {
  const titleId = useId();
  const fieldId = useId();
  const hintId = useId();
  const errorId = useId();
  const field = useRef<HTMLInputElement>(null);
  const save = useSaveStatus();
  const notices = useNotices();
  const canWrite = useCanWrite(false);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // After a refused code, focus returns to the field once React has re-enabled it (it is disabled
  // while the check runs). In the next frame instead, a slow device could still have it disabled.
  const [focusField, setFocusField] = useState(0);
  useEffect(() => {
    if (focusField > 0) field.current?.focus();
  }, [focusField]);

  async function submit() {
    if (pending) return;
    if (code.trim() === "") {
      setError("Enter the access code.");
      field.current?.focus();
      return;
    }
    setPending(true);
    setError(null);
    const result = await callAction(() => unlockScalerSection(code));
    setPending(false);
    if (result.ok) {
      notices.info("Scaler course is unlocked and on.");
      onUnlocked(result.value.sections);
      return;
    }
    if (result.error.code === "signed-out") {
      save.markSignedOut();
      return;
    }
    setError(result.error.code === "failed" ? CODE_FAILED : result.error.message);
    setFocusField((n) => n + 1);
  }

  return (
    <section aria-labelledby={titleId} className={CARD_STYLES}>
      <CardHead titleId={titleId} title="Unlock Scaler course" />
      <form
        className="grid gap-3 px-4 pb-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p id={hintId} className="type-small max-w-[34em] text-muted">
          The Scaler course section is for people taking the Scaler course. If you were given an access code, enter it
          here. You only need to do it once.
        </p>
        <div className="grid gap-1.5">
          <label htmlFor={fieldId} className="type-body-strong w-fit">
            Access code
          </label>
          <div className="flex flex-wrap items-start gap-2">
            <input
              ref={field}
              id={fieldId}
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={64}
              disabled={pending}
              aria-invalid={error ? true : undefined}
              aria-describedby={cn(hintId, error && errorId) || undefined}
              className={cn(
                "type-input h-11 min-w-0 max-w-[20em] flex-[1_1_200px] rounded-md border bg-surface px-3 text-ink",
                error ? "border-danger" : "border-line-strong",
              )}
            />
            <button type="submit" disabled={!canWrite || pending} aria-busy={pending || undefined} className={buttonStyles.secondary}>
              {pending && <Spinner />}
              {pending ? "Checking…" : "Unlock"}
            </button>
          </div>
          {error && (
            <p id={errorId} className="type-small text-danger">
              {error}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
