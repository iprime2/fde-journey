import { describe, expect, it } from "vitest";
import { certChip, moduleChip, phaseChip, pickCurrentModule, pickCurrentPhase, projectChip } from "@/lib/status";

const phase = { start: "2026-12-02", end: "2026-12-15" };

describe("status chips", () => {
  it("phases: complete, this phase, behind, upcoming", () => {
    expect(phaseChip(phase, "2026-12-20", 8, 8)).toEqual({ label: "Complete", variant: "ok" });
    expect(phaseChip(phase, "2026-12-02", 0, 8)).toEqual({ label: "This phase", variant: "now" });
    expect(phaseChip(phase, "2026-12-15", 3, 8)).toEqual({ label: "This phase", variant: "now" });
    expect(phaseChip(phase, "2026-12-16", 3, 8)).toEqual({ label: "Behind", variant: "warn" });
    expect(phaseChip(phase, "2026-12-01", 0, 8)).toEqual({ label: "Upcoming", variant: "neutral" });
  });

  it("modules: complete, current, in progress, not started", () => {
    expect(moduleChip(15, 15, true)).toEqual({ label: "Complete", variant: "ok" });
    expect(moduleChip(2, 15, true)).toEqual({ label: "Current", variant: "now" });
    expect(moduleChip(2, 15, false)).toEqual({ label: "In progress", variant: "neutral" });
    expect(moduleChip(0, 15, false)).toEqual({ label: "Not started", variant: "neutral" });
  });

  it("certifications: passed, or their priority", () => {
    expect(certChip("First", true)).toEqual({ label: "Passed", variant: "ok" });
    expect(certChip("When eligible", false)).toEqual({ label: "When eligible", variant: "neutral" });
  });

  it("projects: complete, in progress, not started", () => {
    expect(projectChip(6, 6)).toEqual({ label: "Complete", variant: "ok" });
    expect(projectChip(1, 6)).toEqual({ label: "In progress", variant: "neutral" });
    expect(projectChip(0, 6)).toEqual({ label: "Not started", variant: "neutral" });
  });
});

describe("where am I now", () => {
  const phases = [
    { n: 1, start: "2026-11-24", end: "2026-12-01" },
    { n: 2, start: "2026-12-02", end: "2026-12-15" },
    { n: 3, start: "2026-12-20", end: "2026-12-22" },
  ];
  const none = () => false;

  it("is the phase whose dates include today", () => {
    expect(pickCurrentPhase(phases, "2026-12-05", none).n).toBe(2);
  });

  it("is the first phase before the journey starts", () => {
    expect(pickCurrentPhase(phases, "2026-11-01", none).n).toBe(1);
  });

  it("is the first unfinished phase in a gap or after the end", () => {
    expect(pickCurrentPhase(phases, "2026-12-17", (p) => p.n === 1).n).toBe(2);
    expect(pickCurrentPhase(phases, "2027-03-01", () => true).n).toBe(3);
  });

  it("is the first module with a class left, else the last", () => {
    const modules = [{ n: 1 }, { n: 2 }, { n: 3 }];
    expect(pickCurrentModule(modules, (m) => m.n === 1).n).toBe(2);
    expect(pickCurrentModule(modules, () => true).n).toBe(3);
  });
});
