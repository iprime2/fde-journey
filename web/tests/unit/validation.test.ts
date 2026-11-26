import { describe, expect, it } from "vitest";
import { linkProblem } from "@/lib/notes";
import { ITEM_IDS, NOTE_IDS, linkSchema, noteSchema, parseField, tickableIdSchema } from "@/lib/validation";

describe("link rule", () => {
  it("accepts empty and https links", () => {
    expect(linkProblem("")).toBeNull();
    expect(linkProblem("   ")).toBeNull();
    expect(linkProblem("https://example.com/demo")).toBeNull();
    expect(linkProblem("  https://example.com/demo  ")).toBeNull();
  });

  it.each([
    ["javascript:alert(1)", "Links must start with https://"],
    ["http://example.com", "Links must start with https://"],
    ["data:text/html,hi", "Links must start with https://"],
    ["ftp://example.com", "Links must start with https://"],
    ["https://", "Links must start with https://"],
    ["https://exa mple.com", "Links must start with https://"],
    ["example.com", "Links must start with https://"],
    ["https://user:secret@example.com", "Links can't include a user name or password."],
    [`https://example.com/${"a".repeat(2000)}`, "Links can be up to 2,000 characters."],
  ])("rejects %s", (link, message) => {
    expect(linkProblem(link)).toBe(message);
  });
});

describe("save inputs", () => {
  it("knows every content id, and the journal only for notes", () => {
    expect(ITEM_IDS.has("l1-1")).toBe(true);
    expect(ITEM_IDS.has("journal")).toBe(false);
    expect(NOTE_IDS.has("journal")).toBe(true);
    expect(parseField(tickableIdSchema, "l1-1", "itemId")).toEqual({ ok: true, value: "l1-1" });
    expect(parseField(tickableIdSchema, "journal", "itemId").ok).toBe(false);
    expect(parseField(tickableIdSchema, "l99-99", "itemId")).toEqual({
      ok: false,
      error: { code: "invalid", field: "itemId", message: "This item can't be saved." },
    });
    expect(parseField(tickableIdSchema, { id: "l1-1" }, "itemId").ok).toBe(false);
  });

  it("limits notes to 10,000 characters and removes NUL characters", () => {
    expect(parseField(noteSchema, "a".repeat(10_000), "note").ok).toBe(true);
    expect(parseField(noteSchema, "a".repeat(10_001), "note")).toEqual({
      ok: false,
      error: { code: "invalid", field: "note", message: "Notes can be up to 10,000 characters." },
    });
    expect(parseField(noteSchema, "a\u0000b", "note")).toEqual({ ok: true, value: "ab" });
    expect(parseField(noteSchema, 5, "note").ok).toBe(false);
  });

  it("trims links and reports the rule that failed", () => {
    expect(parseField(linkSchema, " https://example.com/demo ", "link")).toEqual({ ok: true, value: "https://example.com/demo" });
    expect(parseField(linkSchema, "javascript:alert(1)", "link")).toEqual({
      ok: false,
      error: { code: "invalid", field: "link", message: "Links must start with https://" },
    });
    expect(parseField(linkSchema, null, "link").ok).toBe(false);
  });
});
