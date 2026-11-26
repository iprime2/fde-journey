// Page banners: at most two, the most serious first (design spec, Banner).

export type BannerTone = "error" | "warning" | "info";

export interface BannerSpec {
  id: string;
  tone: BannerTone;
  text: string;
  /** Optional action, shown as an underlined text link after the message. */
  action?: { label: string; href: string };
}

const RANK: Record<BannerTone, number> = { error: 0, warning: 1, info: 2 };

/** Highest first (error, warning, info), keeping the given order within a tone; at most `max`. */
export function pickBanners(list: ReadonlyArray<BannerSpec | null | undefined | false>, max = 2): BannerSpec[] {
  return list
    .filter((b): b is BannerSpec => !!b)
    .map((b, i) => ({ b, i }))
    .sort((x, y) => RANK[x.b.tone] - RANK[y.b.tone] || x.i - y.i)
    .slice(0, max)
    .map((x) => x.b);
}

/** The page rendered without the owner's sign-in (normally such visits go to /login first). */
export const READ_ONLY_BANNER: BannerSpec = {
  id: "read-only",
  tone: "info",
  text: "Read-only. Sign in to save ticks and notes.",
};

export const FIRST_VISIT_BANNER: BannerSpec = {
  id: "first-visit",
  tone: "info",
  text: "Nothing ticked yet. Tick items as you finish them and your progress will show here.",
};

export const OFFLINE_BANNER: BannerSpec = {
  id: "offline",
  tone: "warning",
  text: "You're offline. You can read and search, but changes won't save until you're back online.",
};

export const BACK_ONLINE_BANNER: BannerSpec = { id: "back-online", tone: "info", text: "Back online." };

/** One banner for the page while any change on it failed to save (each item has its own Try again). */
export const SAVE_FAILED_BANNER: BannerSpec = {
  id: "save-failed",
  tone: "error",
  text: "A change wasn't saved. Check your connection, then use Try again next to it.",
};

/**
 * A save was refused because the sign-in ended. `signInHref` returns to the current page. When a
 * note or the weekly notes hold unsaved text, it says to copy it first: signing in leaves the page.
 */
export const signedOutBanner = (signInHref: string, unsavedText = false): BannerSpec => ({
  id: "signed-out",
  tone: "error",
  text: unsavedText
    ? "You were signed out, so that change wasn't saved. Copy any text you typed, then sign in."
    : "You were signed out, so that change wasn't saved.",
  action: { label: "Sign in", href: signInHref },
});

/**
 * Banners a page starts with. The first-visit banner is for Home only, and not while the app is
 * a read-only preview: it asks the owner to tick items, which can't be done yet.
 */
export function pageBanners(opts: { readOnly: boolean; isHome: boolean; hasProgress: boolean }): BannerSpec[] {
  return pickBanners([
    opts.readOnly && READ_ONLY_BANNER,
    opts.isHome && !opts.readOnly && !opts.hasProgress && FIRST_VISIT_BANNER,
  ]);
}
