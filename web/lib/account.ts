// Who is signed in, as the account menu shows it (design spec 4, Avatar and AccountMenu).
// Pure functions, safe to import anywhere. The avatar URL is built on the server, from the
// session, never from anything the browser sends.

/** The only host an avatar photo may come from. */
export const AVATAR_HOST = "avatars.githubusercontent.com";

/** The avatar's size on screen, in CSS pixels. */
export const AVATAR_SIZE = 32;

const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;

/** Splits text into user-perceived characters, so accents and non-Latin letters stay whole. */
function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

/** The first letter or number in a word, or "" if it has none. */
function firstLetter(word: string): string {
  return graphemes(word).find((g) => LETTER_OR_NUMBER.test(g)) ?? "";
}

/**
 * Up to two initials: the first letter of the first and the last word, uppercased. One word gives
 * one letter. Returns "" when the name has no letter or number (the Avatar then shows an icon).
 */
export function initials(name: string | null | undefined): string {
  const letters = (name ?? "").trim().split(/\s+/).map(firstLetter).filter(Boolean);
  if (letters.length === 0) return "";
  const picked = letters.length === 1 ? letters : [letters[0], letters[letters.length - 1]];
  return picked.join("").toLocaleUpperCase();
}

/**
 * The photo to show for a stored `user.image`, or null for initials. Only https URLs on GitHub's
 * avatar host are used (no user name, password or port); the size is set to twice the display
 * size for sharp screens, keeping GitHub's other parameters (for example `v=4`).
 */
export function avatarSrc(image: unknown, displaySize = AVATAR_SIZE): string | null {
  if (typeof image !== "string" || image.length === 0 || image.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(image);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== AVATAR_HOST) return null;
  if (url.username || url.password || url.port) return null;
  url.hash = "";
  url.searchParams.set("s", String(displaySize * 2));
  return url.toString();
}

/** What the account menu needs: the name to show, its initials, and a checked photo URL. */
export interface AccountView {
  name: string;
  initials: string;
  avatar: string | null;
}

/** Shown when GitHub gave no name at all. */
export const FALLBACK_NAME = "GitHub user";

export function accountView(user: { name: string | null | undefined; image: string | null | undefined }): AccountView {
  const name = user.name?.trim() || FALLBACK_NAME;
  return { name, initials: initials(user.name), avatar: avatarSrc(user.image) };
}
