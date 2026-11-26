// Server-side input rules for saving progress. Everything a Server Action receives is untrusted,
// whatever its TypeScript type says, so each value is parsed here before it reaches the database.
import { z } from "zod";
import { trackerContent } from "@/content/tracker-data";
import { JOURNAL_ID, listItems } from "./ids";
import { LINK_ERROR, LINK_MAX, linkProblem } from "./notes";
import type { SaveError, SaveField } from "./save-result";

export const NOTE_MAX = 10_000;
export { LINK_MAX };

/** Ids that can be ticked: every item in the content. */
export const ITEM_IDS: ReadonlySet<string> = new Set(listItems(trackerContent).map((i) => i.id));
/** Ids that can hold a note: every item plus the weekly journal. */
export const NOTE_IDS: ReadonlySet<string> = new Set([...ITEM_IDS, JOURNAL_ID]);

const CANT_SAVE = "This item can't be saved.";

const idIn = (ids: ReadonlySet<string>) =>
  z.string({ error: CANT_SAVE }).max(64, { error: CANT_SAVE }).refine((id) => ids.has(id), { error: CANT_SAVE });

export const tickableIdSchema = idIn(ITEM_IDS);
export const noteIdSchema = idIn(NOTE_IDS);

export const doneSchema = z.boolean({ error: CANT_SAVE });

/** Up to 10,000 characters. NUL characters are removed (Postgres text cannot store them). */
export const noteSchema = z
  .string({ error: "This note can't be saved." })
  .max(NOTE_MAX, { error: "Notes can be up to 10,000 characters." })
  .transform((s) => s.replaceAll("\u0000", ""));

/** Empty, or an https:// address of up to 2,000 characters. Surrounding spaces are trimmed. */
export const linkSchema = z
  .string({ error: LINK_ERROR })
  .transform((s) => s.trim())
  .superRefine((link, ctx) => {
    const problem = linkProblem(link);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: SaveError };

/** Parses one input and turns the first problem into an `invalid` error for that field. */
export function parseField<T>(schema: z.ZodType<T, unknown>, value: unknown, field: SaveField): Parsed<T> {
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, error: { code: "invalid", field, message: result.error.issues[0]?.message ?? CANT_SAVE } };
}
