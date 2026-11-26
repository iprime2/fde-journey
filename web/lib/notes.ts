// Note and link rules shared by the note preview, the note editor, the content links, the save
// actions and the import script. Keep this file free of imports: scripts/import-progress.mjs
// loads it directly with Node.

export const NOTE_PREVIEW_LENGTH = 220;

/** The first 220 characters of a note, then "…". */
export const notePreview = (note: string) =>
  note.length > NOTE_PREVIEW_LENGTH ? `${note.slice(0, NOTE_PREVIEW_LENGTH)}…` : note;

/** Only https links are ever rendered as links. */
export const isHttpsUrl = (value: string) => /^https:\/\/\S+$/i.test(value.trim());

export const LINK_ERROR = "Links must start with https://";

export const LINK_MAX = 2_000;

/**
 * The server's full link rule, or null when the (trimmed) link is fine: empty, or an https://
 * address of at most 2,000 characters with a host and no user name or password.
 */
export function linkProblem(value: string): string | null {
  const link = value.trim();
  if (link === "") return null;
  if (link.length > LINK_MAX) return "Links can be up to 2,000 characters.";
  if (!isHttpsUrl(link)) return LINK_ERROR;
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return LINK_ERROR;
  }
  if (url.protocol !== "https:" || !url.hostname) return LINK_ERROR;
  if (url.username || url.password) return "Links can't include a user name or password.";
  return null;
}

/** Message for the link field on blur, or null when the link is empty or fine. */
export const linkError = (value: string) => (value.trim() === "" || isHttpsUrl(value) ? null : LINK_ERROR);

export const hasNoteOrLink = (p: { note: string; link: string } | undefined) => !!p && (p.note !== "" || p.link !== "");
