"use client";

import { useFormStatus } from "react-dom";
import { cn } from "./cn";
import { GitHubMark } from "./icons";
import { buttonStyles } from "./ui";

/** "Sign in with GitHub"; "Opening GitHub…" while the form is on its way (design spec 4, Button). */
export function SignInButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cn(buttonStyles.primary, "w-full")}
    >
      <GitHubMark size={20} />
      {pending ? "Opening GitHub…" : "Sign in with GitHub"}
    </button>
  );
}
