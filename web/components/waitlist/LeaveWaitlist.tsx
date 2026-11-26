"use client";

// "Leave the waitlist" (design spec 5, /waitlist): a destructive Dialog, no typed confirm (only a
// place in line is lost). On success the action signs the person out and opens
// /login?status=left-waitlist. Offline: the button is disabled.
import { useState } from "react";
import { leaveWaitlist } from "@/app/actions/account";
import { OFFLINE_BANNER } from "@/lib/banners";
import { Banner } from "../Banner";
import { type ConfirmOutcome, ConfirmDialog } from "../Dialog";
import { buttonStyles } from "../ui";
import { useOnline } from "../useOnline";

const FAILED = "Couldn't leave the waitlist. Check your connection and try again.";

export function LeaveWaitlist() {
  const online = useOnline();
  const [open, setOpen] = useState(false);

  async function leave(): Promise<ConfirmOutcome> {
    let result: Awaited<ReturnType<typeof leaveWaitlist>> | undefined;
    try {
      result = await leaveWaitlist();
    } catch {
      return { error: FAILED };
    }
    // Success redirects to /login: the browser is on its way, so the dialog stays busy.
    if (!result) return new Promise<ConfirmOutcome>(() => {});
    if (result.ok) return null;
    return { error: result.error.code === "failed" ? FAILED : result.error.message };
  }

  return (
    <>
      <button type="button" disabled={!online} onClick={() => setOpen(true)} className={buttonStyles.dangerSecondary}>
        Leave the waitlist
      </button>
      {open && (
        <ConfirmDialog
          tone="danger"
          title="Leave the waitlist?"
          body="This deletes your account and your place in line. If you sign in again later, you'll join at the back."
          confirmLabel="Leave the waitlist"
          pendingLabel="Leaving…"
          onConfirm={leave}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/** The usual offline warning, above the waitlist card. */
export function OfflineNotice() {
  const online = useOnline();
  if (online) return null;
  return <Banner tone={OFFLINE_BANNER.tone}>{OFFLINE_BANNER.text}</Banner>;
}
