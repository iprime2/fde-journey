// /privacy (design spec 5 and 8, v0.6 text): public, no sign-in, the same page for everyone.
// Signed-out visitors reach it from /login; waitlisted users from /waitlist; everyone else from
// Settings. Static: nothing here reads the session or the database.
//
// Numbers here are checked facts tied to their source (design spec 5, "Numbers on the page"): the
// 6-hour restore history is Neon's history_retention_seconds (21,600) on the production project.
// Vercel publishes no log retention for Hobby, so the page gives none. The owner-access sentence
// was approved by the owner as written on 2026-11-26: change it only with their approval.
import type { Metadata } from "next";
import Link from "next/link";
import { CenteredPage } from "@/components/CenteredPage";
import { formatDate } from "@/lib/dates";
import { GITHUB_NEW_ISSUE_URL } from "@/lib/links";

export const metadata: Metadata = { title: "Privacy" };

/**
 * The date the wording last changed, not the build date (design spec 5, "Last updated"). Change it
 * in the same commit as any change to the text, and set it to the launch date when it goes live.
 */
const LAST_UPDATED = "2026-11-26";

const LINK = "text-accent underline underline-offset-2 [overflow-wrap:anywhere]";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="type-title">{title}</h2>
      {children}
    </section>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="grid list-disc gap-1 pl-5 marker:text-muted">{children}</ul>;
}

export default function PrivacyPage() {
  return (
    <CenteredPage wide>
      <article className="type-body grid max-w-[34em] gap-6">
        <header className="grid gap-1.5">
          <h1 className="type-display">Privacy</h1>
          <p className="type-small text-muted">Last updated {formatDate(LAST_UPDATED)}.</p>
        </header>

        <Section title="In short">
          <List>
            <li>FDE Journey keeps your GitHub profile and the progress you record, so you can track your journey.</li>
            <li>Nothing is sold, shared or used for ads.</li>
            <li>Admins see counts and dates, never your notes, links, Weekly notes or email address.</li>
            <li>You can download or delete your data at any time in Settings.</li>
          </List>
        </Section>

        <Section title="What's stored">
          <List>
            <li>
              From GitHub, when you sign in: your name, profile picture, username, email address, and your GitHub account
              number (it stays the same if you rename your account).
            </li>
            <li>
              What you add: what you mark done and when, your notes and links, your Weekly notes, and which sections you
              show.
            </li>
            <li>
              Activity: a record of each change you make (which item, what kind of change, and when). It never includes
              the text of a note.
            </li>
            <li>
              Sign-ins: when each sign-in started and ends, and the browser and internet (IP) address used. These keep
              you signed in and help stop misuse. They&apos;re deleted when the sign-in ends or your account is deleted.
            </li>
            <li>
              Claude export keys, if you create any: a scrambled form of each key (the key itself can&apos;t be read back
              from it), when it was created and when it was last used.
            </li>
            <li>
              Scaler course: whether and when you unlocked it. If you type a wrong access code, that a wrong try happened
              and when, never what you typed.
            </li>
            <li>If you&apos;re on the waitlist: when you joined.</li>
            <li>
              Admin actions about you: if an admin lets you in, suspends or reactivates you, or makes you an admin, that
              action and its date are recorded.
            </li>
          </List>
        </Section>

        <Section title="Where it's stored">
          <List>
            <li>The database is hosted by Neon, in Singapore.</li>
            <li>
              The app runs on Vercel, in Singapore. Vercel keeps server logs of requests to the app for a short time and
              deletes them on its own schedule. The app never writes your notes, links, email address or keys to these
              logs.
            </li>
            <li>Everything travels over encrypted connections (HTTPS).</li>
          </List>
        </Section>

        <Section title="Who can see it">
          <List>
            <li>You.</li>
            <li>
              Admins, on the admin pages: your name, profile picture and username; whether your account is active,
              waitlisted or suspended; when you signed up and were last active; how many items you&apos;ve marked done in
              each section; and, in the audit log, the admin actions about you and any wrong Scaler access codes you
              tried. Never your notes, links, Weekly notes or email address.
            </li>
            <li>
              Anyone you give one of your Claude export keys to (for example a Claude session): your ticks, notes, links
              and section choices, until you revoke the key in Settings.
            </li>
            <li>
              The owner runs FDE Journey and its database, so they can reach everything stored, including notes. They
              only do that to keep the app running or to fix a problem, and they don&apos;t read your notes, links or
              Weekly notes.
            </li>
          </List>
        </Section>

        <Section title="What isn't done with it">
          <List>
            <li>Nothing is sold or shared with anyone.</li>
            <li>No ads, and no tracking cookies. The only cookie keeps you signed in.</li>
            <li>No email is sent. Your email address is stored because GitHub shares it, and it isn&apos;t used for anything else.</li>
          </List>
        </Section>

        <Section title="Download or delete your data">
          <List>
            <li>
              Download: Settings → &ldquo;Download my data&rdquo; gives you your GitHub profile details, ticks, notes,
              links, Weekly notes, section choices and activity history, as a JSON file (a plain text format other apps
              can read).
            </li>
            <li>
              Delete: Settings → &ldquo;Delete my account&rdquo; removes your account, progress, notes, activity,
              settings, export keys and sign-ins at once. The audit log keeps its entries, but they show &ldquo;a deleted
              account&rdquo; instead of your name.
            </li>
            <li>
              Neon keeps a restore history of the database for 6 hours, so for up to 6 hours after you delete your
              account it could still be brought back from there. After that, it&apos;s gone.
            </li>
            <li>On the waitlist: &ldquo;Leave the waitlist&rdquo; deletes your account too.</li>
          </List>
        </Section>

        <Section title="Questions">
          <p>
            Open an issue on the project&apos;s GitHub page. Issues are public, so don&apos;t include your email address or
            anything private. You don&apos;t need to ask before downloading or deleting your data; you can do both
            yourself in Settings.
          </p>
          <p>
            <a href={GITHUB_NEW_ISSUE_URL} target="_blank" rel="noopener noreferrer" className={LINK}>
              Open an issue on GitHub
              <span aria-hidden="true"> ↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        </Section>

        <p>
          <Link href="/" className={LINK}>
            Back to FDE Journey
          </Link>
        </p>
      </article>
    </CenteredPage>
  );
}
