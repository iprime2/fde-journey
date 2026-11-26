"use client";

// Keeps the owner signed in while they use the app (M2-DESIGN.md, "Session renewal"). Pages can't
// set cookies, so once a day the browser asks the refreshSession() action to renew the sign-in.
// The last renewal time is kept in localStorage; if storage is blocked, it asks once per page load,
// which is harmless (the server only renews when a day has passed).
import { useEffect } from "react";
import { refreshSession } from "@/app/actions/auth";
import { SESSION_REFRESHED_KEY, isRefreshDue, parseTimestamp } from "@/lib/save-state";

function readLast(): number | null {
  try {
    return parseTimestamp(window.localStorage.getItem(SESSION_REFRESHED_KEY));
  } catch {
    return null;
  }
}

function remember(now: number) {
  try {
    window.localStorage.setItem(SESSION_REFRESHED_KEY, String(now));
  } catch {
    // Storage blocked or full: ask again on the next page load.
  }
}

let askedThisLoad = false;

export function SessionKeeper() {
  useEffect(() => {
    if (askedThisLoad || !isRefreshDue(readLast(), Date.now())) return;
    askedThisLoad = true;
    refreshSession()
      .then((result) => {
        // ok: false means signed out; the next page load goes to /login, so there is nothing to do.
        if (result?.ok) remember(Date.now());
      })
      .catch(() => {
        // Offline or the request failed: try again on the next page load.
        askedThisLoad = false;
      });
  }, []);
  return null;
}
