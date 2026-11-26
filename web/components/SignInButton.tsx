"use client";

import { useFormStatus } from "react-dom";
import { cn } from "./cn";
import { GitHubMark } from "./icons";
import { Spinner, buttonStyles } from "./ui";

/**
 * "Continue with GitHub"; "Opening GitHub…" with a spinner while the form is on its way
 * (design spec 4, Button, size lg). `describedBy` points at the access line above it.
 */
export function SignInButton({ disabled = false, describedBy }: { disabled?: boolean; describedBy?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      aria-describedby={describedBy}
      className={cn(buttonStyles.primaryLg, "w-full")}
    >
      <GitHubMark size={20} className={cn("flex-none", pending && "motion-safe:hidden")} />
      {pending && <Spinner />}
      {pending ? "Opening GitHub…" : "Continue with GitHub"}
    </button>
  );
}
