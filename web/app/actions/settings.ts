"use server";
// Settings actions (design spec 5, /settings): section switches, the Scaler access code, Claude
// export keys and "Download my data". Every action takes the user from the server session first
// (requireUser; waitlisted users are refused), validates its input, and touches only that user's
// rows (lib/settings-db.ts). Results are typed (lib/action-result.ts).
//
//   const result = await setSectionVisible("projects", true);
//   if (result.ok) applySections(result.value);
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { SWITCHABLE_SECTIONS, type SectionChoices, type SwitchableSection } from "@/lib/access-types";
import { normaliseAccessCode, verifyAccessCode } from "@/lib/access-code";
import { type ActionResult, fail, invalid, ok } from "@/lib/action-result";
import { touchActivity } from "@/lib/activity";
import { hashExportKey, newExportKey } from "@/lib/export-token";
import { requireUser } from "@/lib/session";
import { auditScalerCodeFailure, buildMyData, myDataFileName, readScalerCodeHash, sectionSettingsFor } from "@/lib/settings";
import {
  EXPORT_KEYS_MAX,
  SCALER_TRIES_PER_HOUR,
  addExportKey,
  ensureOwnerSettings,
  revokeExportKey as revokeKey,
  setScaler,
  setSection,
  takeScalerTry,
  unlockScaler,
} from "@/lib/settings-db";
import { guarded } from "./guard";

const isSwitchable = (value: unknown): value is SwitchableSection => typeof value === "string" && (SWITCHABLE_SECTIONS as readonly string[]).includes(value);

/**
 * Shows or hides a section (Roadmap can't be hidden). Scaler can be switched on only once it is
 * unlocked: otherwise "invalid". Returns the sections as now saved.
 */
export async function setSectionVisible(section: SwitchableSection, on: boolean): Promise<ActionResult<SectionChoices>> {
  return guarded("Saving a section choice", async () => {
    const me = await requireUser({ onSignedOut: "throw" });
    if (!isSwitchable(section)) return invalid("Roadmap is always on.", "section");
    if (typeof on !== "boolean") return invalid("Couldn't save this change.", "on");
    const db = await getDb();
    // The owner's row starts with every section on (and Scaler unlocked), not the new-user
    // defaults, so make it before the first change.
    if (me.isSuperAdmin) await ensureOwnerSettings(me.userId, db);
    if (section === "scaler") {
      if (!(await setScaler(me.userId, db, on))) return invalid("Enter the Scaler access code first.", "section");
    } else {
      await setSection(me.userId, db, section, on);
    }
    await touchActivity(db, me.userId);
    revalidatePath("/", "layout");
    return ok((await sectionSettingsFor(db, me.userId, me.isSuperAdmin)).sections);
  });
}

/**
 * Unlocks the Scaler section with the access code, and switches it on. Five tries an hour; each
 * wrong one is counted in the audit log (never the code).
 */
export async function unlockScalerSection(code: string): Promise<ActionResult<{ sections: SectionChoices }>> {
  return guarded("Checking the Scaler access code", async () => {
    const me = await requireUser({ onSignedOut: "throw" });
    const db = await getDb();
    if (me.isSuperAdmin) {
      await ensureOwnerSettings(me.userId, db);
    } else {
      const clean = normaliseAccessCode(code);
      if (!clean) return invalid("That code isn't right.", "code");
      const stored = await readScalerCodeHash(db);
      if (!stored) return fail({ code: "not-found", message: "There's no Scaler access code yet. Ask the owner for one." });
      const tryNumber = await takeScalerTry(me.userId, db);
      if (tryNumber === null) return fail({ code: "rate-limited", message: "Too many tries. Try again in an hour." });
      if (!(await verifyAccessCode(clean, stored))) {
        await auditScalerCodeFailure(db, me.userId, tryNumber);
        const left = SCALER_TRIES_PER_HOUR - tryNumber;
        return invalid(left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left this hour.` : "That code isn't right. Try again in an hour.", "code");
      }
      await unlockScaler(me.userId, db);
    }
    await touchActivity(db, me.userId);
    revalidatePath("/", "layout");
    return ok({ sections: (await sectionSettingsFor(db, me.userId, me.isSuperAdmin)).sections });
  });
}

/** A new Claude export key. `key` is shown once and never again (only its hash is kept). */
export async function createExportKey(): Promise<ActionResult<{ id: string; key: string; createdAt: string }>> {
  return guarded("Creating an export key", async () => {
    const me = await requireUser({ onSignedOut: "throw" });
    const key = newExportKey();
    const row = await addExportKey(me.userId, await getDb(), hashExportKey(key));
    if (!row) return invalid(`You already have ${EXPORT_KEYS_MAX} keys. Revoke one first.`);
    revalidatePath("/settings");
    return ok({ id: row.id, key, createdAt: row.createdAt.toISOString() });
  });
}

const KEY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Revokes one of the user's own export keys. Another user's key id is "not-found". */
export async function revokeExportKey(keyId: string): Promise<ActionResult<{ revoked: true }>> {
  return guarded("Revoking an export key", async () => {
    const me = await requireUser({ onSignedOut: "throw" });
    if (typeof keyId !== "string" || !KEY_ID.test(keyId)) return fail({ code: "not-found", message: "That key isn't there any more." });
    if (!(await revokeKey(me.userId, await getDb(), keyId))) return fail({ code: "not-found", message: "That key isn't there any more." });
    revalidatePath("/settings");
    return ok({ revoked: true });
  });
}

/**
 * "Download my data": the user's profile (name and GitHub username), section choices, progress
 * (ticks, notes, links, Weekly notes) and activity history, as pretty-printed JSON. Save `json`
 * as `fileName`.
 */
export async function downloadMyData(): Promise<ActionResult<{ fileName: string; json: string }>> {
  return guarded("Preparing a data download", async () => {
    const me = await requireUser({ onSignedOut: "throw" });
    const now = new Date();
    const data = await buildMyData(await getDb(), me.userId, me.isSuperAdmin, now);
    return ok({ fileName: myDataFileName(now), json: JSON.stringify(data, null, 2) });
  });
}
