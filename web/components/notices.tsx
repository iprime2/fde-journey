"use client";

// Result banners for the Settings and admin pages (design spec 7, "Results of actions"): each
// action ends with an info banner that says what happened ("Sam Example is suspended."), or an
// error banner when the permission is gone. They sit in the page's banner area with the offline,
// signed-out and save-failed banners (components/BannerArea.tsx).
import { createContext, use, useState } from "react";
import { ACTION_FAILED, type ActionError, type ActionResult } from "@/lib/action-result";
import type { BannerSpec } from "@/lib/banners";
import { BannerArea } from "./BannerArea";
import type { ConfirmOutcome } from "./Dialog";
import { useSaveStatus } from "./save/SaveStatusProvider";

interface Notices {
  notice: BannerSpec | null;
  /** Shows `text` as the page's result banner, replacing the last one. */
  info(text: string): void;
  error(text: string): void;
  clear(): void;
}

const NoticeContext = createContext<Notices | null>(null);

let counter = 0;

export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = useState<BannerSpec | null>(null);
  // A new id each time, so the same words twice in a row are announced again.
  const show = (tone: BannerSpec["tone"], text: string) => setNotice({ id: `notice-${++counter}`, tone, text });
  const value: Notices = {
    notice,
    info: (text) => show("info", text),
    error: (text) => show("error", text),
    clear: () => setNotice(null),
  };
  return <NoticeContext value={value}>{children}</NoticeContext>;
}

const NONE: Notices = { notice: null, info: () => {}, error: () => {}, clear: () => {} };

export function useNotices(): Notices {
  return use(NoticeContext) ?? NONE;
}

/** The page's banner area, with its result banner. */
export function NoticeBanners({ banners = [] }: { banners?: BannerSpec[] }) {
  const { notice } = useNotices();
  return <BannerArea banners={notice ? [notice, ...banners] : banners} />;
}

/**
 * What a failed action means on these pages. Signed out: the page's signed-out banner (and the
 * dialog closes). Permission gone: the error banner "You no longer have permission to do this."
 * (and the dialog closes). A field problem goes under the field; anything else stays in the dialog.
 */
export function useActionFailure(): (error: ActionError, opts?: { field?: string }) => ConfirmOutcome {
  const save = useSaveStatus();
  const notices = useNotices();
  return (error, opts) => {
    if (error.code === "signed-out") {
      save.markSignedOut();
      return null;
    }
    if (error.code === "forbidden" && error.message === "You no longer have permission to do this.") {
      notices.error(error.message);
      return null;
    }
    if (error.code === "invalid" && opts?.field && error.field === opts.field) return { fieldError: error.message };
    return { error: error.message };
  };
}

/**
 * Calls a Server Action and always returns an ActionResult: a dropped connection or an unexpected
 * answer becomes the retryable "failed", never an uncaught error.
 */
export async function callAction<T>(action: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    const result = await action();
    if (result && typeof result === "object" && "ok" in result) return result;
  } catch {
    // Falls through to "failed".
  }
  return { ok: false, error: ACTION_FAILED };
}
