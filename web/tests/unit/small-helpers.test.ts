import { describe, expect, it } from "vitest";
import {
  CERTS_DESCRIPTION,
  PROJECTS_DESCRIPTION,
  ROADMAP_DESCRIPTION,
  SCALER_DESCRIPTION,
} from "@/content/page-copy";
import { READINESS_REVIEW } from "@/content/schedule";
import { trackerContent as c } from "@/content/tracker-data";
import {
  BACK_ONLINE_BANNER,
  FIRST_VISIT_BANNER,
  OFFLINE_BANNER,
  READ_ONLY_BANNER,
  type BannerSpec,
  pageBanners,
  pickBanners,
} from "@/lib/banners";
import { formatDate } from "@/lib/dates";
import { LINK_ERROR, NOTE_MAX, NOTE_PREVIEW_LENGTH, NOTE_TOO_LONG, hasNoteOrLink, isHttpsUrl, linkError, notePreview, noteProblem } from "@/lib/notes";
import { noteSchema } from "@/lib/validation";
import { isStoredOpen, parseStoredList, withMember } from "@/lib/open-state";

describe("banners", () => {
  const error: BannerSpec = { id: "e", tone: "error", text: "A change wasn't saved." };

  it("show at most two, most serious first", () => {
    expect(pickBanners([READ_ONLY_BANNER, OFFLINE_BANNER, error]).map((b) => b.id)).toEqual(["e", "offline"]);
    expect(pickBanners([null, false, READ_ONLY_BANNER])).toEqual([READ_ONLY_BANNER]);
    expect(pickBanners([BACK_ONLINE_BANNER, READ_ONLY_BANNER]).map((b) => b.id)).toEqual(["back-online", "read-only"]);
  });

  it("start with the read-only notice in the preview", () => {
    expect(pageBanners({ readOnly: true, isHome: true, hasProgress: false })).toEqual([READ_ONLY_BANNER]);
    expect(pageBanners({ readOnly: true, isHome: false, hasProgress: false })).toEqual([READ_ONLY_BANNER]);
  });

  it("welcome a first visit on Home once saving works", () => {
    expect(pageBanners({ readOnly: false, isHome: true, hasProgress: false })).toEqual([FIRST_VISIT_BANNER]);
    expect(pageBanners({ readOnly: false, isHome: true, hasProgress: true })).toEqual([]);
    expect(pageBanners({ readOnly: false, isHome: false, hasProgress: false })).toEqual([]);
  });
});

describe("notes", () => {
  it("checks the note limit in the browser with the server's rule and words", () => {
    expect(noteProblem("")).toBeNull();
    expect(noteProblem("a".repeat(NOTE_MAX))).toBeNull();
    expect(noteProblem("a".repeat(NOTE_MAX + 1))).toBe("Notes can be up to 10,000 characters.");
    // The server says the same for the same note.
    const server = noteSchema.safeParse("a".repeat(NOTE_MAX + 1));
    expect(server.success).toBe(false);
    expect(server.error?.issues[0]?.message).toBe(NOTE_TOO_LONG);
    expect(noteSchema.safeParse("a".repeat(NOTE_MAX)).success).toBe(true);
  });

  it("preview the first 220 characters", () => {
    const long = "a".repeat(NOTE_PREVIEW_LENGTH + 5);
    expect(notePreview(long)).toBe(`${"a".repeat(NOTE_PREVIEW_LENGTH)}…`);
    expect(notePreview("a".repeat(NOTE_PREVIEW_LENGTH))).toBe("a".repeat(NOTE_PREVIEW_LENGTH));
  });

  it("only treat https as a link", () => {
    expect(isHttpsUrl("https://example.com/demo")).toBe(true);
    expect(isHttpsUrl("HTTPS://example.com")).toBe(true);
    expect(isHttpsUrl("http://example.com")).toBe(false);
    expect(isHttpsUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpsUrl("https://")).toBe(false);
  });

  it("explain a bad link, and accept an empty one", () => {
    expect(linkError("")).toBeNull();
    expect(linkError("https://example.com/demo")).toBeNull();
    expect(linkError("example.com")).toBe(LINK_ERROR);
    expect(hasNoteOrLink({ note: "", link: "" })).toBe(false);
    expect(hasNoteOrLink({ note: "", link: "https://example.com/demo" })).toBe(true);
  });
});

describe("remembered open state", () => {
  it("reads the stored list, or null when missing or broken", () => {
    expect(parseStoredList(null)).toBeNull();
    expect(parseStoredList("not json")).toBeNull();
    expect(parseStoredList('{"a":1}')).toBeNull();
    expect(parseStoredList("[1,3]")).toEqual(["1", "3"]);
    expect(parseStoredList('["l1-1", null]')).toEqual(["l1-1"]);
  });

  it("adds and removes members without duplicates", () => {
    expect(withMember(["1"], "3", true)).toEqual(["1", "3"]);
    expect(withMember(["1", "3"], "3", true)).toEqual(["1", "3"]);
    expect(withMember(["1", "3"], "1", false)).toEqual(["3"]);
  });

  it("uses the default until something is stored", () => {
    expect(isStoredOpen(null, "1", true)).toBe(true);
    expect(isStoredOpen([], "1", true)).toBe(false);
    expect(isStoredOpen(["2"], "2", false)).toBe(true);
  });
});

describe("page copy still matches the content", () => {
  it("roadmap: eight phases over the journey dates", () => {
    expect(c.phases).toHaveLength(8);
    expect(ROADMAP_DESCRIPTION).toContain(`from ${formatDate(c.phases[0].start)} to ${formatDate(c.phases[7].end)}`);
    expect(c.phases[7].end).toBe(READINESS_REVIEW);
  });

  it("scaler: module counts", () => {
    const core = c.scaler.filter((m) => m.kind === "core").length;
    const electives = c.scaler.filter((m) => m.kind === "elective").length;
    expect(SCALER_DESCRIPTION).toBe(`${c.scaler.length} modules: ${core} core and ${electives} electives.`);
  });

  it("certifications and projects", () => {
    expect(c.certs).toHaveLength(7);
    expect(CERTS_DESCRIPTION).toContain("last step");
    expect(c.projects).toHaveLength(3);
    expect(PROJECTS_DESCRIPTION).toMatch(/^Three portfolio projects/);
  });
});
