import { describe, expect, it } from "vitest";
import { SAVE_FAILED_BANNER, signedOutBanner, pickBanners, READ_ONLY_BANNER, OFFLINE_BANNER } from "@/lib/banners";
import { msUntilNextIstMidnight } from "@/lib/dates";
import {
  type FieldView,
  SAVE_TEXT,
  SESSION_REFRESH_INTERVAL_MS,
  type SaveStatus,
  afterSaveFailed,
  afterSaveSucceeded,
  combineStatus,
  isRefreshDue,
  isTextFailureKey,
  nextSaveStep,
  noteButtonLabel,
  parseTimestamp,
  saveLines,
  saveOnLeave,
  shownStatus,
  statusAfterStep,
} from "@/lib/save-state";

const at = (isoUtc: string) => Date.parse(isoUtc);

describe("next midnight in India", () => {
  it("is when 18:30 UTC comes round", () => {
    expect(msUntilNextIstMidnight(at("2026-11-30T18:29:59.000Z"))).toBe(1_000);
    expect(msUntilNextIstMidnight(at("2026-11-30T12:30:00.000Z"))).toBe(6 * 3_600_000);
  });

  it("is a full day away exactly at midnight IST", () => {
    expect(msUntilNextIstMidnight(at("2026-11-30T18:30:00.000Z"))).toBe(86_400_000);
  });

  it("works across the UTC date line and the year end", () => {
    // 23:00 UTC on 31 Dec is already 04:30 on 1 Jan in India: 19.5 hours to go.
    expect(msUntilNextIstMidnight(at("2026-12-31T23:00:00.000Z"))).toBe(19.5 * 3_600_000);
    expect(msUntilNextIstMidnight(at("2027-01-01T00:00:00.001Z"))).toBe(18.5 * 3_600_000 - 1);
  });
});

describe("save status", () => {
  it("shows a failure first, then waiting, saving, saved", () => {
    expect(combineStatus(["saved", "error"])).toBe("error");
    expect(combineStatus(["waiting", "error"])).toBe("error");
    expect(combineStatus(["saving", "waiting"])).toBe("waiting");
    expect(combineStatus(["saving", "saved"])).toBe("saving");
    expect(combineStatus(["idle", "saved"])).toBe("saved");
    expect(combineStatus([])).toBe("idle");
  });

  it("uses the spec's words", () => {
    expect(SAVE_TEXT).toEqual({
      saving: "Saving…",
      saved: "Saved",
      // The full stop makes "Not saved. Try again" read as two parts.
      error: "Not saved.",
      waiting: "Not saved yet. Saves when you're back online.",
    });
  });

  it("labels the note button from the typed text, saved or not", () => {
    expect(noteButtonLabel(false, false)).toBe("Add note");
    expect(noteButtonLabel(false, true)).toBe("Edit note");
    expect(noteButtonLabel(true, true)).toBe("Hide note");
    expect(noteButtonLabel(true, false)).toBe("Hide note");
  });

  it("tells failed text fields from failed ticks", () => {
    expect(isTextFailureKey("note:l1-1")).toBe(true);
    expect(isTextFailureKey("link:l1-1")).toBe(true);
    expect(isTextFailureKey("note:journal")).toBe(true);
    expect(isTextFailureKey("tick:l1-1")).toBe(false);
  });
});

describe("when a text field saves", () => {
  const base = { mode: "write" as const, busy: false, problem: null, value: "new", saved: "old" };

  it("sends changed text when it can write", () => {
    expect(nextSaveStep(base)).toBe("save");
  });

  it("never saves while read-only (signed out)", () => {
    expect(nextSaveStep({ ...base, mode: "read-only" })).toBe("blocked");
    expect(nextSaveStep({ ...base, mode: "read-only", busy: true })).toBe("blocked");
  });

  it("waits for a running save to end before deciding again", () => {
    expect(nextSaveStep({ ...base, busy: true })).toBe("queue");
    // Even with nothing changed: the running save may be sending older text.
    expect(nextSaveStep({ ...base, busy: true, value: "old" })).toBe("queue");
    expect(nextSaveStep({ ...base, busy: true, mode: "offline" })).toBe("queue");
  });

  it("doesn't send text that breaks the field's rule", () => {
    expect(nextSaveStep({ ...base, problem: "Links must start with https://" })).toBe("problem");
    expect(nextSaveStep({ ...base, problem: "Links must start with https://", mode: "offline" })).toBe("problem");
  });

  it("sends nothing when the text is what was saved", () => {
    expect(nextSaveStep({ ...base, value: "old" })).toBe("unchanged");
    expect(nextSaveStep({ ...base, value: "old", mode: "offline" })).toBe("unchanged");
  });

  it("doesn't save on leaving a field whose exact text just failed (Try again does)", () => {
    expect(saveOnLeave("draft", "draft")).toBe(false);
    expect(saveOnLeave("draft, edited", "draft")).toBe(true);
    expect(saveOnLeave("draft", null)).toBe(true);
  });

  it("waits for the connection when offline", () => {
    expect(nextSaveStep({ ...base, mode: "offline" })).toBe("wait");
  });

  it("never leaves 'Saving…' behind after a step that sends nothing", () => {
    const all: SaveStatus[] = ["idle", "saving", "saved", "error", "waiting"];
    for (const s of all) {
      expect(statusAfterStep("problem", s)).toBe("idle");
      expect(statusAfterStep("unchanged", s)).toBe(s === "saved" ? "saved" : "idle");
      expect(statusAfterStep("wait", s)).toBe("waiting");
    }
  });

  it("after a success, saves again only if the text changed meanwhile (blur during a save ends at Saved)", () => {
    // Blur, Hide note or Escape during a save asks for another save of the same text.
    expect(afterSaveSucceeded("draft", "draft")).toBe("saved");
    expect(afterSaveSucceeded("draft", "draft, more")).toBe("again");
    // The second round finds nothing changed, so it settles instead of staying "saving".
    expect(nextSaveStep({ ...base, value: "draft", saved: "draft" })).toBe("unchanged");
    expect(statusAfterStep("unchanged", "saving")).toBe("idle");
  });

  it("after a failure, tells a rule, a sign-out, a dropped connection and a plain failure apart", () => {
    const plain = { online: true, changed: false, reconnected: false };
    expect(afterSaveFailed("invalid", plain)).toBe("invalid");
    expect(afterSaveFailed("invalid", { ...plain, changed: true })).toBe("again");
    expect(afterSaveFailed("signed-out", plain)).toBe("signed-out");
    expect(afterSaveFailed("signed-out", { ...plain, online: false })).toBe("signed-out");
    // A save in flight when the connection drops counts as not saved yet.
    expect(afterSaveFailed("failed", { ...plain, online: false })).toBe("waiting");
    expect(afterSaveFailed("failed", plain)).toBe("error");
    expect(afterSaveFailed("failed", { ...plain, changed: true })).toBe("error");
  });

  it("saves by itself once when the connection came back while a save was on its way", () => {
    const back = { online: true, changed: false, reconnected: true };
    expect(afterSaveFailed("failed", back)).toBe("again");
    // Still offline: keep waiting; a rule or a sign-out wins over the retry.
    expect(afterSaveFailed("failed", { ...back, online: false })).toBe("waiting");
    expect(afterSaveFailed("invalid", back)).toBe("invalid");
    expect(afterSaveFailed("signed-out", back)).toBe("signed-out");
  });

  it("shows unsaved text as waiting offline and as not saved when signed out", () => {
    const dirty = { dirty: true, problem: false };
    expect(shownStatus("idle", { mode: "offline", ...dirty })).toBe("waiting");
    expect(shownStatus("saving", { mode: "offline", ...dirty })).toBe("waiting");
    expect(shownStatus("error", { mode: "offline", ...dirty })).toBe("waiting");
    // A rule-breaking link won't save when the connection returns either.
    expect(shownStatus("idle", { mode: "offline", dirty: true, problem: true })).toBe("idle");
    expect(shownStatus("saved", { mode: "offline", dirty: false, problem: false })).toBe("saved");
    expect(shownStatus("idle", { mode: "read-only", ...dirty })).toBe("error");
    expect(shownStatus("idle", { mode: "read-only", dirty: false, problem: false })).toBe("idle");
    expect(shownStatus("saving", { mode: "write", ...dirty })).toBe("saving");
    expect(shownStatus("waiting", { mode: "write", ...dirty })).toBe("waiting");
  });

  it("stops waiting or failing as soon as the text is back to what was saved", () => {
    const clean = { dirty: false, problem: false };
    // Offline, typed, then put back: no "Not saved yet…" for the next 800 ms.
    expect(shownStatus("waiting", { mode: "offline", ...clean })).toBe("idle");
    expect(shownStatus("waiting", { mode: "write", ...clean })).toBe("idle");
    expect(shownStatus("error", { mode: "write", ...clean })).toBe("idle");
    // A save still running says so, and "Saved" stays.
    expect(shownStatus("saving", { mode: "write", ...clean })).toBe("saving");
    expect(shownStatus("saved", { mode: "offline", ...clean })).toBe("saved");
  });
});

describe("lines under a note (spec: Closing with unsaved changes)", () => {
  const note = (status: SaveStatus, error: string | null = null): FieldView => ({ kind: "note", status, error });
  const link = (status: SaveStatus, error: string | null = null): FieldView => ({ kind: "link", status, error });
  const closed = (fields: FieldView[], opts: { signedOut?: boolean; savingShown?: boolean } = {}) =>
    saveLines({ fields, signedOut: opts.signedOut ?? false, savingShown: opts.savingShown ?? false });

  it("the save still running 1 s after closing: Saving… (never before)", () => {
    expect(closed([note("saving"), link("idle")], { savingShown: false })).toEqual({ saving: false, saved: false, save: null, field: null });
    expect(closed([note("saving"), link("idle")], { savingShown: true })).toEqual({ saving: true, saved: false, save: null, field: null });
  });

  it("the save failed: Not saved. with Try again", () => {
    expect(closed([note("error"), link("saved")])).toEqual({
      saving: false,
      saved: false,
      save: { text: "Not saved.", tone: "danger", action: "retry" },
      field: null,
    });
  });

  it("the link breaks a rule: Link not saved. plus the rule, with Fix link", () => {
    expect(closed([note("saved"), link("idle", "Links must start with https://")]).field).toEqual({
      text: "Link not saved. Links must start with https://",
      tone: "danger",
      action: "fix-link",
    });
  });

  it("the note is too long: Note not saved. plus the limit, with Fix note", () => {
    expect(closed([note("idle", "Notes can be up to 10,000 characters."), link("idle")]).field).toEqual({
      text: "Note not saved. Notes can be up to 10,000 characters.",
      tone: "danger",
      action: "fix-note",
    });
  });

  it("offline: Not saved yet. Saves when you're back online., no action", () => {
    expect(closed([note("waiting"), link("idle")]).save).toEqual({ text: SAVE_TEXT.waiting, tone: "warn", action: null });
  });

  it("signed out while using: Not saved., no action", () => {
    const lines = closed([note("error"), link("idle", "Links must start with https://")], { signedOut: true });
    expect(lines.save).toEqual({ text: "Not saved.", tone: "danger", action: null });
    expect(lines.field?.action).toBeNull();
  });

  it("everything saved: no line (a success is the row looking normal)", () => {
    const lines = closed([note("saved"), link("idle")]);
    expect(lines.save).toBeNull();
    expect(lines.field).toBeNull();
    expect(lines.saving).toBe(false);
    // "Saved" is only for the live region and the open editor.
    expect(lines.saved).toBe(true);
  });

  it("shows at most two lines: the save line, then one field line", () => {
    const lines = closed([note("error", "Notes can be up to 10,000 characters."), link("idle", "Links must start with https://")]);
    expect(lines.save?.text).toBe("Not saved.");
    expect(lines.field?.text).toBe("Note not saved. Notes can be up to 10,000 characters.");
  });

  it("the weekly notes: the same save line; the rule shows under the field, without Fix", () => {
    const journal = (status: SaveStatus, error: string | null = null): FieldView => ({ kind: "journal", status, error });
    expect(saveLines({ fields: [journal("saving")], signedOut: false, savingShown: true }).saving).toBe(true);
    expect(saveLines({ fields: [journal("error")], signedOut: false, savingShown: true }).save?.action).toBe("retry");
    expect(saveLines({ fields: [journal("idle", "Notes can be up to 10,000 characters.")], signedOut: false, savingShown: true }).field).toEqual({
      text: "Not saved. Notes can be up to 10,000 characters.",
      tone: "danger",
      action: null,
    });
  });
});

describe("banners for saving", () => {
  it("put errors first and send Sign in back to the page", () => {
    const signedOut = signedOutBanner("/login?next=%2Froadmap");
    expect(signedOut.action).toEqual({ label: "Sign in", href: "/login?next=%2Froadmap" });
    expect(signedOut.text).toBe("You were signed out, so that change wasn't saved.");
    expect(signedOutBanner("/login", true).text).toBe(
      "You were signed out, so that change wasn't saved. Copy any text you typed, then sign in.",
    );
    expect(pickBanners([READ_ONLY_BANNER, OFFLINE_BANNER, SAVE_FAILED_BANNER, signedOut]).map((b) => b.id)).toEqual([
      "save-failed",
      "signed-out",
    ]);
  });
});

describe("daily sign-in renewal", () => {
  const now = at("2026-11-26T10:00:00Z");

  it("reads only plain stored timestamps", () => {
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp("")).toBeNull();
    expect(parseTimestamp("abc")).toBeNull();
    expect(parseTimestamp("-5")).toBeNull();
    expect(parseTimestamp("1.5")).toBeNull();
    expect(parseTimestamp(String(now))).toBe(now);
  });

  it("is due when never done or a day has passed", () => {
    expect(isRefreshDue(null, now)).toBe(true);
    expect(isRefreshDue(now - SESSION_REFRESH_INTERVAL_MS, now)).toBe(true);
    expect(isRefreshDue(now - SESSION_REFRESH_INTERVAL_MS + 1, now)).toBe(false);
    expect(isRefreshDue(now - 60_000, now)).toBe(false);
  });

  it("is due when the stored time is in the future (a changed clock)", () => {
    expect(isRefreshDue(now + 60_000, now)).toBe(true);
  });
});
