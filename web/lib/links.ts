// Public links the app shows (design spec 5 and 8). Safe to import anywhere.

/** Where people ask about their data or a suspension: a new issue on the public repo. Issues are public. */
export const GITHUB_NEW_ISSUE_URL = "https://github.com/iprime2/fde-journey/issues/new";

/** A GitHub profile page, for the "@username" links on the admin pages. */
export const githubProfileUrl = (login: string) => `https://github.com/${encodeURIComponent(login)}`;
