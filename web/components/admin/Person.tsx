// The person cell of every admin list (design spec 4, DataTable): avatar, name, and "@username" as
// a link to the GitHub profile. Never the email address.
import type { AdminPerson } from "@/lib/admin-db";
import { githubProfileUrl } from "@/lib/links";
import { Avatar } from "../account/Avatar";
import { cn } from "../cn";

export function GithubLink({ login, className }: { login: string; className?: string }) {
  return (
    <a
      href={githubProfileUrl(login)}
      target="_blank"
      rel="noopener noreferrer"
      data-person-link=""
      className={cn("type-small text-muted underline underline-offset-2 [overflow-wrap:anywhere] hover:text-ink", className)}
    >
      @{login}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (GitHub profile, opens in a new tab)</span>
    </a>
  );
}

/** Avatar, then the name (wraps) and "@username" under it. `heading` renders the name as an h3 (cards). */
export function PersonCell({ person, heading = false, children }: { person: AdminPerson; heading?: boolean; children?: React.ReactNode }) {
  const Name = heading ? "h3" : "span";
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Avatar initials={person.initials} src={person.avatar} className="mt-0.5" />
      <div className="grid min-w-0 justify-items-start">
        <Name tabIndex={heading ? -1 : undefined} className="type-body-strong text-left [overflow-wrap:anywhere]">
          {person.name}
        </Name>
        {person.githubLogin && <GithubLink login={person.githubLogin} />}
        {children}
      </div>
    </div>
  );
}
