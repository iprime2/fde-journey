# M4: multi-user (design note, draft for the owner's approval)

Status: draft, 2026-11-26. Expands section 12 of `PLAN.md`. Nothing here is built yet.

Owner decisions, 2026-11-26 (they replace the invite-only idea in the first draft):
1. Sign-up is open to the first 100 users, a cap the owner can raise later. Anyone who signs up after that joins a waitlist.
2. An admin dashboard shows user data. It is visible only to admins. The owner is the only admin for now, but can make other people admins with specific permissions.

## 1. Goal
Other people can sign in and track their own AI-engineer or FDE journey. Each person sees and changes only their own progress. The owner's existing data stays exactly as it is.

**Not in M4:**
- custom roadmaps per user (everyone shares the default content)
- teams or sharing progress with others
- payments
- the insights dashboard (M5)

## 2. Who can sign in: a 100-user cap, then a waitlist
- **Open sign-up up to a cap.** Anyone with a GitHub account can sign up while there are fewer than `user_cap` active users. The cap starts at **100** and is stored in the database, so an admin can change it without a deploy.
- **Users and sessions are keyed by numeric GitHub id**, because usernames can be renamed.
- **Waitlist past the cap.** A new sign-up gets `status = waitlisted`. They can sign in, but only see a waitlist page: their place in line, and "We'll let you in as places open."
- **Letting people in from the waitlist.** An admin lets people in by hand, or raises the cap. Raising the cap lets in the earliest waitlisted users first, up to the new cap.
- **No email is sent in M4.** People see their new status the next time they sign in. Email notices are a later option.
- **The cap check cannot be raced.** Counting active users and activating a new one happen in one database transaction, under a lock (a Postgres advisory lock). Two people signing up at the same moment can never take the cap to 101.
- **The owner is never capped or waitlisted.** `OWNER_GITHUB_ID` is the bootstrap **super admin** and cannot be locked out, demoted or deleted from the admin pages. The owner doesn't count toward the cap.
- **The mode lives in one place** (`ACCESS_MODE`):
  - `owner-only` (today)
  - `capped` (M4: open up to the cap, then the waitlist)
  - `open` (no cap, later)

  The sign-in page copy switches on it. In `capped` mode: "New here? Continue with GitHub to start your own tracker. Places are limited; if they're full you'll join the waitlist."
- **Providers:** GitHub in M4. Google is a small follow-up.
- **Suspended users** (`status = suspended`, set by an admin) cannot sign in, and their sessions end at once.

## 3. Data model
| Change | Detail |
|---|---|
| `progress.user_id` | text, not null, references `user(id)` on delete cascade. The primary key becomes `(user_id, item_id)`. The weekly notes row (`journal`) becomes per user automatically. |
| `user.status` | `active`, `waitlisted` or `suspended`; plus `activated_at` and `waitlisted_at` (the waitlist order). |
| `user_permission` | (user_id, permission, granted_by, granted_at). An admin is any user with at least one permission. The permissions are listed in section 6. The super admin (`OWNER_GITHUB_ID`) holds all of them implicitly, and they can't be removed. |
| `app_setting` | Key and value, starting with `user_cap = 100`; changed from the admin dashboard. |
| `admin_audit` | Who did what to whom, and when: let in, suspend, cap change, permission grant or revoke. It never stores note text. |
| `user_settings` | One row per user: which sections are shown, an optional weekly target (for M5), and the time zone. |
| `progress_event` | id, user_id, item_id, kind (`done`, `undone`, `note`, `link`), at. Indexed on `(user_id, at)`. Every save writes one row, inside the same request. It holds no note text, only that a note changed. This is what M5's weekly charts read. |
| `export_token` | For the Claude export: one per user, stored only as a hash, can be revoked. |

**Migration on the live database**, in one transaction:
1. Add `user_id` as nullable.
2. Fill it with the owner's user id, found through the GitHub account whose id is `OWNER_GITHUB_ID`.
3. Check that no row is left empty.
4. Make the column not null and swap the primary key.
5. Set every existing user to `status = active` (today only the owner exists). The owner's admin rights come from `OWNER_GITHUB_ID`, not from a row.

The migration refuses to run if the owner's user can't be found. It is checked first on a Neon branch (a copy of production), with row counts compared before and after.

## 4. Keeping users apart (the most important part)
- **One way in.** Every page, Server Action and API route gets the user id only from the server-side session (`requireUser()`), never from the request body, URL or a cookie value.
- **Every query is scoped.** Data functions take `userId` as a required first argument. No function reads or writes `progress`, `progress_event`, `user_settings` or `export_token` without it.
- **Tests prove it:**
  - a unit test that fails if any query on those tables lacks a user filter
  - for every action and page: user A never sees, lists, exports, ticks or edits user B's data
  - the export endpoint with A's token never returns B's rows
- **Admin pages** check the specific permission on the server for every request and action (section 6).
- **Row-level security** in Postgres (the database itself enforcing the user filter) was considered. It is left for later, because the HTTP driver sends separate requests and so can't carry a per-request user setting safely. The data layer plus the tests above are the guard for M4.

## 5. Content for other users
The roadmap, papers, books and certifications are the owner's plan, but they work as a sensible default for anyone on the same path.

| Section | Owner | Other users (default) |
|---|---|---|
| Roadmap, Reading, Certifications | On | On (shared default content) |
| Scaler | On | Off; can be turned on in Settings |
| Projects, Career | On | Off; can be turned on in Settings |

Hidden sections leave the navigation for that user; their item ids stay the same, so nothing breaks.

## 6. New pages
- **`/settings`** for every user:
  - which sections to show
  - "Download my data" (JSON of all their progress and notes)
  - "Delete my account": confirm by typing the GitHub username; removes the user, sessions, progress, events, settings and tokens
- **`/admin`, the admin dashboard.**
  - **Visibility:** the "Admin" item appears in the navigation only for users with at least one admin permission. Every admin page and action checks the specific permission on the server, on every request. Hiding the link is never the protection.
  - **Overview** (`metrics.view`):
    - active users against the cap
    - waitlist size
    - sign-ups per week
    - users active in the last 7 and 30 days
    - items completed this week across all users
  - **Users** (`users.view`):
    - each user's GitHub name, avatar and username
    - status, sign-up date and last active date
    - counts of items done per section
  - **Waitlist** (`waitlist.manage`):
    - the queue in order
    - let one person in, or the next N
    - remove an entry
  - **User actions** (`users.manage`): suspend or reactivate a user, and end their sessions.
  - **Settings** (`settings.manage`): change the user cap; raising it lets in waitlisted users in order.
  - **Admins** (`admins.manage`, super admin only at first): give a user specific permissions, or take them away. The super admin's own permissions can't be changed.
  - **Audit log** (`audit.view`): every admin action, newest first.
  - **Privacy rule:** admins see counts and dates, never anyone's notes, links or Weekly notes. The privacy page says exactly what admins can see.
- **`/privacy`**, public:
  - what is stored: GitHub name, avatar, email, progress, notes and links
  - where: Neon, Singapore; Vercel
  - that nothing is sold or shared
  - how to export or delete your data
  - who to contact

## 7. Security and limits
- **Rate limits** on sign-in and on saves per user (carried from M3); Vercel firewall rules for the sign-in endpoints.
- **Waitlisted and suspended users** have a session but no access to any app page or Server Action, only the waitlist page and sign-out. Tests prove they can't read or save progress.
- **Permission checks** live in one helper (`requirePermission(p)`). Tests cover each admin page and action:
  - without the permission: refused
  - with it: allowed
  - the super admin can't be demoted
- **Bot sign-ups:** watch sign-ups after launch. If bots fill places, add a check, such as a minimum GitHub account age, or a challenge before taking a place.
- **Logs** never contain note text or emails.
- **Free-plan limits:** check Neon and Vercel again before opening sign-up (storage, compute hours, function calls). Each user's data is small, a few hundred rows, so 100 users fit easily; compute hours are the limit to watch.

## 8. Delivery
Two pull requests, each reviewed (code and UX) before merge:
1. **M4a: data and isolation.**
   - The migration and the per-user data layer.
   - `progress_event` logging and `requireUser()`.
   - The cross-user tests.
   - The owner's experience doesn't change.
   - Rehearsed on a Neon branch, then applied to production.
2. **M4b: sign-up, waitlist, admin and settings.**
   - Capped sign-up with the waitlist page.
   - The admin dashboard, with permissions and the audit log.
   - `/settings` (sections, export, delete) and `/privacy`.
   - The per-user Claude export token.
   - `capped` mode switched on last, after the owner tries everything with a second test account.

**End-to-end tests** use two made-up seeded users (and an admin), at phone and desktop width.

## 9. Open questions for the owner
1. (Decided: open up to 100 users, then the waitlist.)
2. Section defaults for other users: does the table in section 5 look right?
3. Google sign-in: in M4b or later?
4a. Should the admin dashboard show users' email addresses? The default is no; GitHub username and avatar only.
4. Is a privacy page with you as the contact OK? The contact would be an address you choose, written into the page by you, not by Claude.
5. Name: does it stay "FDE Journey" for everyone?
