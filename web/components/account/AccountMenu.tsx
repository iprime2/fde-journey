"use client";

// Desktop account area at the foot of the sidebar (design spec 4, AccountMenu): a disclosure
// button with the avatar and name, opening a panel above it with the full name and Sign out.
// A disclosure, not an ARIA menu: with one action, the menu role's arrow keys add nothing.
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "@/app/actions/auth";
import type { AccountView } from "@/lib/account";
import { cn } from "../cn";
import { ChevronUpIcon } from "../icons";
import { Avatar } from "./Avatar";
import { SignOutButton } from "./SignOutButton";

export function AccountMenu({ account }: { account: AccountView }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const area = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const signOutButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Opening moves focus to Sign out, the panel's only action.
    signOutButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    // A click or tap anywhere outside the account area closes the panel.
    const onPointer = (e: PointerEvent) => {
      if (!area.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div
      ref={area}
      className="relative"
      onBlur={(e) => {
        // Tab moving focus out of the panel and the button closes it, as the More sheet does.
        const next = e.relatedTarget as Node | null;
        if (next && !area.current?.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Account: ${account.name}`}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex min-h-[52px] w-full items-center gap-2.5 rounded-md px-2.5 text-left text-ink hover:bg-hover motion-safe:transition-[color,background-color,border-color] motion-safe:duration-150",
          open && "bg-hover",
        )}
      >
        <Avatar initials={account.initials} src={account.avatar} />
        <span className="type-body-strong min-w-0 flex-1 truncate">{account.name}</span>
        <ChevronUpIcon size={16} className={cn("flex-none text-muted", open && "rotate-180")} />
      </button>
      {/* After the button in reading order (it shows above it): Tab from Sign out leaves the area.
          17 px up: 8 px clear of the sidebar's divider (8 px padding plus the 1 px line below it). */}
      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 bottom-[calc(100%+17px)] z-30 rounded-lg border border-line bg-surface p-1.5 shadow-overlay"
      >
        <p className="type-small mb-1 border-b border-line px-2.5 pt-1.5 pb-2 text-muted">
          Signed in with GitHub as <span className="block font-medium text-ink [overflow-wrap:anywhere]">{account.name}</span>
        </p>
        <form action={signOut}>
          <SignOutButton look="row" buttonRef={signOutButton} />
        </form>
      </div>
    </div>
  );
}
