// Note, link and weekly-notes fields (design spec 4, NoteEditor). Add the border colour
// (`border-line-strong`, or `border-danger` with an error) and the size.
// Read-only (signed out): `sunk` background and full-contrast `ink` text, not the 0.5 opacity
// of disabled controls, so a note stays readable and can still be selected and copied.
export const FIELD_STYLES =
  "type-input w-full rounded-md border bg-surface px-3 py-2.5 text-ink [overflow-wrap:anywhere] read-only:cursor-default read-only:bg-sunk";
