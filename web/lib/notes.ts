// Note and link rules shared by the note preview, the note editor and the content links.

export const NOTE_PREVIEW_LENGTH = 220;

/** The first 220 characters of a note, then "…". */
export const notePreview = (note: string) =>
  note.length > NOTE_PREVIEW_LENGTH ? `${note.slice(0, NOTE_PREVIEW_LENGTH)}…` : note;

/** Only https links are ever rendered as links. */
export const isHttpsUrl = (value: string) => /^https:\/\/\S+$/i.test(value.trim());

export const LINK_ERROR = "Links must start with https://";

/** Message for the link field on blur, or null when the link is empty or fine. */
export const linkError = (value: string) => (value.trim() === "" || isHttpsUrl(value) ? null : LINK_ERROR);

export const hasNoteOrLink = (p: { note: string; link: string } | undefined) => !!p && (p.note !== "" || p.link !== "");
