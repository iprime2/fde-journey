// M4b front-end helpers: navigation with chosen sections, admin tabs, and the admin, Settings and
// waitlist wording (design spec 3.5, 5 and 8). Made-up names only.
import { describe, expect, it } from "vitest";
import { AUDIT_FILTERS, DEFAULT_SECTIONS, OWNER_SECTIONS, PERMISSIONS } from "@/lib/access-types";
import {
  aheadLine,
  auditSentence,
  capChange,
  capSavedMessage,
  doneLine,
  formatIstDateTime,
  lastActiveLabel,
  letInDefault,
  letInMax,
  letInResult,
  parseWholeNumber,
  PERMISSION_COPY,
  permissionDiff,
  permissionDiffText,
  sentenceText,
  usernameProblem,
} from "@/lib/admin-format";
import { currentAdminTab, firstAdminHref, isAdminPath, visibleAdminTabs } from "@/lib/admin-tabs";
import { FIRST_VISIT_BANNER, firstVisitBanner } from "@/lib/banners";
import { offSectionsPrompt, orList, phoneSplit, sectionOfHref, visibleHrefs } from "@/lib/nav";

describe("navigation with chosen sections (design spec 3.5)", () => {
  it("shows Home and the visible sections in today's order", () => {
    expect(visibleHrefs(OWNER_SECTIONS)).toEqual(["/", "/roadmap", "/reading", "/scaler", "/certs", "/projects", "/career"]);
    expect(visibleHrefs(DEFAULT_SECTIONS)).toEqual(["/", "/roadmap", "/reading", "/certs"]);
  });

  it("keeps Roadmap even if a stored choice says otherwise", () => {
    expect(visibleHrefs({ ...DEFAULT_SECTIONS, roadmap: false })).toContain("/roadmap");
  });

  it("puts Home and the first three visible sections in the bar, the rest in More", () => {
    expect(phoneSplit(OWNER_SECTIONS)).toEqual({ bar: ["/", "/roadmap", "/reading", "/scaler"], more: ["/certs", "/projects", "/career"] });
    expect(phoneSplit(DEFAULT_SECTIONS)).toEqual({ bar: ["/", "/roadmap", "/reading", "/certs"], more: [] });
    const fewest = { roadmap: true, reading: false, scaler: false, certs: false, projects: false, career: false };
    expect(phoneSplit(fewest)).toEqual({ bar: ["/", "/roadmap"], more: [] });
  });

  it("names a page's section", () => {
    expect(sectionOfHref("/scaler")).toBe("scaler");
    expect(sectionOfHref("/")).toBeNull();
    expect(sectionOfHref("/settings")).toBeNull();
  });

  it("lists the sections that are off in the first-visit sentence", () => {
    expect(orList(["A"])).toBe("A");
    expect(orList(["A", "B"])).toBe("A or B");
    expect(orList(["A", "B", "C"])).toBe("A, B or C");
    expect(offSectionsPrompt(DEFAULT_SECTIONS)).toBe("Want Scaler, Projects or Career too? Turn them on in");
    expect(offSectionsPrompt({ ...OWNER_SECTIONS, career: false })).toBe("Want Career too? Turn it on in");
    expect(offSectionsPrompt(OWNER_SECTIONS)).toBeNull();
  });

  it("adds the Settings link to the first-visit banner only when a section is off", () => {
    expect(firstVisitBanner(null)).toBe(FIRST_VISIT_BANNER);
    const banner = firstVisitBanner(offSectionsPrompt(DEFAULT_SECTIONS));
    expect(banner.text).toBe(`${FIRST_VISIT_BANNER.text} Want Scaler, Projects or Career too? Turn them on in`);
    expect(banner.action).toEqual({ label: "Settings", href: "/settings", after: "." });
  });
});

describe("audit log filters (design spec 5, v0.6)", () => {
  it("can show Scaler access code entries and deleted accounts", () => {
    expect(AUDIT_FILTERS["scaler-code"]).toEqual(["scaler_code_set", "scaler_code_failed"]);
    expect(AUDIT_FILTERS["accounts-deleted"]).toEqual(["account_deleted"]);
  });
});

describe("admin tabs (design spec 5)", () => {
  it("shows only the tabs the user may open, in order", () => {
    expect(visibleAdminTabs([...PERMISSIONS]).map((t) => t.label)).toEqual(["Overview", "Users", "Waitlist", "Sign-up", "Admins", "Audit log"]);
    expect(visibleAdminTabs(["audit.view", "users.view", "metrics.view"]).map((t) => t.label)).toEqual(["Overview", "Users", "Audit log"]);
    expect(visibleAdminTabs([])).toEqual([]);
  });

  it("sends the Admin link to the first allowed tab, or nowhere", () => {
    expect(firstAdminHref([...PERMISSIONS])).toBe("/admin");
    expect(firstAdminHref(["audit.view", "waitlist.manage"])).toBe("/admin/waitlist");
    expect(firstAdminHref(["users.manage"])).toBeNull();
    expect(firstAdminHref([])).toBeNull();
  });

  it("knows which tab a path is on", () => {
    expect(currentAdminTab("/admin")?.key).toBe("overview");
    expect(currentAdminTab("/admin/users")?.key).toBe("users");
    expect(currentAdminTab("/admin/audit")?.key).toBe("audit");
    expect(currentAdminTab("/settings")).toBeNull();
    expect(isAdminPath("/admin/sign-up")).toBe(true);
    expect(isAdminPath("/administrator")).toBe(false);
  });
});

describe("admin wording (design spec 8)", () => {
  const now = Date.parse("2026-12-03T10:00:00Z"); // 15:30 IST, Thu 3 Dec 2026

  it("formats times in IST", () => {
    expect(formatIstDateTime("2026-11-30T08:35:00Z")).toBe("30 Nov 2026, 14:05 IST");
    expect(formatIstDateTime("2026-11-30T20:00:00Z")).toBe("1 Dec 2026, 01:30 IST");
  });

  it("says when someone was last active", () => {
    expect(lastActiveLabel(null, now)).toBe("Never");
    expect(lastActiveLabel("2026-12-03T00:00:00Z", now)).toBe("Today");
    expect(lastActiveLabel("2026-12-02T10:00:00Z", now)).toBe("Yesterday");
    expect(lastActiveLabel("2026-11-20T10:00:00Z", now)).toBe("20 Nov");
    expect(lastActiveLabel("2025-11-20T10:00:00Z", now)).toBe("20 Nov 2025");
  });

  it("lists done counts by section, only those above zero", () => {
    const none = { roadmap: 0, resources: 0, reading: 0, scaler: 0, certs: 0, projects: 0, career: 0 };
    expect(doneLine(none)).toBe("Nothing yet");
    expect(doneLine({ ...none, roadmap: 12, resources: 30, reading: 3 })).toBe("Roadmap 12 · Resources 30 · Reading 3");
  });

  it("tells a waitlisted person how many are ahead", () => {
    expect(aheadLine(1)).toBe("You're next.");
    expect(aheadLine(2)).toBe("1 person is ahead of you.");
    expect(aheadLine(12)).toBe("11 people are ahead of you.");
  });

  it("reads whole numbers only, within range", () => {
    expect(parseWholeNumber(" 5 ", 1, 7)).toBe(5);
    for (const bad of ["", "0", "8", "1.5", "-2", "1e3", "five"]) expect(parseWholeNumber(bad, 1, 7)).toBeNull();
    expect(parseWholeNumber("0", 0, 1000)).toBe(0);
  });

  it("works out how many can be let in", () => {
    expect(letInMax(58, 7)).toBe(7);
    expect(letInMax(0, 7)).toBe(0);
    expect(letInDefault(58, 7)).toBe(5);
    expect(letInDefault(2, 7)).toBe(2);
    expect(letInResult(5)).toBe("5 people were let in.");
    expect(letInResult(1)).toBe("1 person was let in.");
  });

  it("asks before raising the cap while people wait, or lowering it below the places taken", () => {
    expect(capChange(100, 120, 100, 7)).toEqual({ kind: "raise", admits: 7 });
    expect(capChange(100, 103, 100, 7)).toEqual({ kind: "raise", admits: 3 });
    expect(capChange(100, 120, 42, 0)).toEqual({ kind: "plain" });
    // Raising but still at or below the places taken lets nobody in.
    expect(capChange(30, 40, 42, 7)).toEqual({ kind: "plain" });
    expect(capChange(100, 30, 42, 7)).toEqual({ kind: "lower" });
    expect(capChange(100, 99, 42, 7)).toEqual({ kind: "plain" });
    expect(capSavedMessage(120, 0)).toBe("Cap saved: 120 places.");
    expect(capSavedMessage(120, 7)).toBe("Cap saved: 120 places. 7 people were let in.");
    expect(capSavedMessage(1000, 1)).toBe("Cap saved: 1,000 places. 1 person was let in.");
  });

  it("names the permissions as the Admins page does (v0.6)", () => {
    expect(PERMISSION_COPY["settings.manage"]).toEqual({
      label: "Change the user cap and Scaler code",
      description: "Set how many people can have a place, and the Scaler access code.",
    });
    expect(PERMISSION_COPY["audit.view"].description).toBe("Every admin action and account change, newest first.");
  });

  it("describes permission changes", () => {
    expect(permissionDiff(["users.view", "audit.view"], ["users.view", "waitlist.manage"])).toEqual({ give: ["waitlist.manage"], take: ["audit.view"] });
    expect(permissionDiffText(["audit.view"], ["waitlist.manage", "users.view", "audit.view"])).toBe("Give: See users, Manage the waitlist.");
    expect(permissionDiffText(["users.view", "audit.view"], ["users.view"])).toBe("Take away: See the audit log.");
  });

  it("checks the typed username for deleting an account", () => {
    expect(usernameProblem("", "sam-example")).toBe("Type your GitHub username to confirm.");
    expect(usernameProblem("sam-exampel", "sam-example")).toBe("That doesn't match your username. Type sam-example.");
    expect(usernameProblem("  @Sam-Example ", "sam-example")).toBeNull();
  });

  it("writes one plain sentence per audit entry, never more than names and counts", () => {
    const sam = { githubLogin: "sam-example", name: "Sam Example" };
    const entry = (action: Parameters<typeof auditSentence>[0]["action"], details: Record<string, unknown> = {}, target: typeof sam | null = sam) =>
      sentenceText(auditSentence({ action, target, targetDeleted: target === null, details }));
    expect(entry("let_in")).toBe("Let in @sam-example.");
    expect(entry("let_in_many", { count: 5 }, null)).toBe("Let in 5 people from the waitlist.");
    expect(entry("waitlist_removed", {}, null)).toBe("Removed a deleted account from the waitlist.");
    expect(entry("suspended")).toBe("Suspended @sam-example.");
    expect(entry("reactivated")).toBe("Reactivated @sam-example.");
    expect(entry("cap_changed", { from: 100, to: 120, admitted: 7 }, null)).toBe("Changed the cap from 100 to 120 and let in 7 people.");
    expect(entry("cap_changed", { from: 120, to: 100, admitted: 0 }, null)).toBe("Changed the cap from 120 to 100.");
    expect(entry("admin_added", { gave: ["waitlist.manage", "users.view"], took: [] })).toBe("Made @sam-example an admin: See users, Manage the waitlist.");
    expect(entry("permissions_changed", { gave: ["audit.view"], took: ["waitlist.manage"] })).toBe(
      "Changed @sam-example's permissions. Gave: See the audit log. Took away: Manage the waitlist.",
    );
    expect(entry("admin_removed")).toBe("Removed @sam-example as an admin.");
    // v0.6 wording for what people do to their own account.
    expect(entry("scaler_code_failed", { tryInHour: 2 }, null)).toBe("Entered a wrong Scaler access code (try 2 of 5 this hour).");
    expect(entry("account_deleted", { status: "active" }, null)).toBe("Deleted their account.");
    expect(entry("account_deleted", { status: "waitlisted" }, null)).toBe("Left the waitlist, which deleted their account.");
    expect(entry("reactivated_to_waitlist")).toBe("Reactivated @sam-example. No place was free, so they joined the waitlist.");
    // Usernames stay separate parts, so the page can keep them on one line.
    expect(auditSentence({ action: "suspended", target: sam, targetDeleted: false, details: {} })).toEqual(["Suspended ", { login: "sam-example" }, "."]);
  });
});
