"use client";

// The submit button inside a <form action={signOut}>: "Signing out…" while it is on its way
// (design spec 4, AccountMenu).
import { useFormStatus } from "react-dom";
import { cn } from "../cn";
import { LogOutIcon } from "../icons";
import { Spinner, buttonStyles } from "../ui";

const LOOKS = {
  /** A row in the desktop account panel: 44 px, 20 px icon. */
  row: "flex min-h-11 w-full items-center gap-3 rounded-md px-2.5 text-left type-body-strong text-ink hover:bg-hover disabled:cursor-progress",
  /** The secondary button in the phone More sheet: 44 px, 18 px icon, natural width. */
  secondary: cn(buttonStyles.secondary, "flex-none px-3.5"),
  /** Fallback when the account can't be shown: the plain sidebar button from M2. */
  ghost: cn(buttonStyles.ghost, "w-full justify-start gap-3 px-3"),
} as const;

export function SignOutButton({
  look,
  buttonRef,
}: {
  look: keyof typeof LOOKS;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  const { pending } = useFormStatus();
  const iconSize = look === "secondary" ? 18 : 20;
  return (
    <button ref={buttonRef} type="submit" disabled={pending} aria-busy={pending || undefined} className={LOOKS[look]}>
      <LogOutIcon size={iconSize} className={cn("flex-none", look !== "secondary" && "text-muted", pending && "motion-safe:hidden")} />
      {pending && <Spinner />}
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
