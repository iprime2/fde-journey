"use client";

// A 32 px circle with initials underneath and, on top, the GitHub photo when there is one
// (design spec 4, Avatar). Always aria-hidden: the name is beside it as text.
import { useState } from "react";
import { cn } from "../cn";
import { UserIcon } from "../icons";

export function Avatar({
  initials,
  src,
  className,
}: {
  /** Worked out on the server (lib/account.ts), so server and browser render the same letters. */
  initials: string;
  /** Already checked on the server: an https GitHub avatar URL, or null. */
  src: string | null;
  className?: string;
}) {
  // The URL that failed to load, if any. Keyed by URL so a new photo gets a fresh try.
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span
      aria-hidden="true"
      data-avatar={src && failed !== src ? "photo" : "initials"}
      className={cn(
        "type-small relative grid size-8 flex-none place-items-center overflow-hidden rounded-full bg-accent-soft font-semibold text-accent",
        // A 1 px ring drawn over the photo too, so light photos keep an edge.
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:shadow-[inset_0_0_0_1px_var(--line)] after:content-['']",
        className,
      )}
    >
      {initials || <UserIcon size={18} />}
      {src && failed !== src && (
        // eslint-disable-next-line @next/next/no-img-element -- tiny external avatar, already sized by GitHub (design spec 4, Avatar)
        <img
          src={src}
          alt=""
          width={32}
          height={32}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(src)}
          // The image arrives with the server's HTML, so it can fail before React is listening;
          // on mount, treat an image that already finished with no pixels as failed.
          ref={(img) => {
            if (img?.complete && img.naturalWidth === 0) setFailed(src);
          }}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
}
