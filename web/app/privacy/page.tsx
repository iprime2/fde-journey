// /privacy (design spec 5 and 8): public, no sign-in, the same page for everyone. Signed-out
// visitors reach it from /login; waitlisted users from /waitlist; everyone else from Settings.
// Static: nothing here reads the session or the database.
//
// Before launch (M4-DESIGN 10.5, open questions in the design spec), the lead checks and fills in:
// how long Vercel keeps its logs, how long Neon keeps restore history, and the owner's wording on
// reaching stored data. Until then those sentences say what is true without a number.
import type { Metadata } from "next";
import Link from "next/link";
import { CenteredPage } from "@/components/CenteredPage";
import { formatDate } from "@/lib/dates";
import { GITHUB_NEW_ISSUE_URL } from "@/lib/links";

export const metadata: Metadata = { title: "Privacy" };

/** Change with the text. */
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
              If you&apos;re on the waitlist: when you joined. If an admin lets you in, suspends you or reactivates you,
              that action and its date are recorded.
            </li>
          </List>
        </Section>

        <Section title="Where it's stored">
          <List>
            <li>The database is hosted by Neon, in Singapore.</li>
            <li>
              The app runs on Vercel, in Singapore. Vercel keeps short-lived technical logs of visits. The app&apos;s own
              logs never contain your notes or email address.
            </li>
            <li>Everything travels over encrypted connections (HTTPS).</li>
          </List>
        </Section>

        <Section title="Who can see it">
          <List>
            <li>You.</li>
            <li>
              Admins, on the admin pages: your name, profile picture and username; whether your account is active,
              waitlisted or suspended; when you signed up and were last active; and how many items you&apos;ve marked
              done in each section. Never your notes, links, Weekly notes or email address.
            </li>
            <li>
              The owner runs the database, so, like the owner of any app, they could reach stored data directly, for
              example to fix a problem. They don&apos;t read notes or links.
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
              Download: Settings → &ldquo;Download my data&rdquo; gives you everything listed above that&apos;s about you,
              as a JSON file (a plain text format other apps can read).
            </li>
            <li>
              Delete: Settings → &ldquo;Delete my account&rdquo; removes your account, progress, notes, activity and
              sign-ins at once. Copies in the database&apos;s backup history are removed automatically after a while.
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
