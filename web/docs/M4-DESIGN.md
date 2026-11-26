# M4: multi-user (design note, draft for the owner's approval)

Status: draft, 2026-11-26. Expands section 12 of `PLAN.md`. Nothing here is built yet.

## 1. Goal
Other people can sign in and track their own AI-engineer or FDE journey. Each person sees and changes only their own progress. The owner's existing data stays exactly as it is.

**Not in M4:**
- custom roadmaps per user (everyone shares the default content)
- teams or sharing progress with others
- payments
- the insights dashboard (M5)

## 2. Who can sign in
- **Invite-only first.** An admin adds an invite on an admin page by GitHub username. On that person's first sign-in, the app checks their GitHub profile against the invite and then pins their **numeric GitHub id**, because usernames can be renamed. Invites can be revoked.
- **The owner is the first admin:** `OWNER_GITHUB_ID` stays as the bootstrap admin, so the owner can never be locked out.
- **The mode is set in one place** (`ACCESS_MODE`): `owner-only` (today), `invite-only` (M4), `open` (later). The sign-in page copy already switches on it.
- **Providers:** GitHub in M4. Google is a small follow-up once invites work, because invites would then also need email matching.

## 3. Data model
| Change | Detail |
|---|---|
| `progress.user_id` | text, not null, references `user(id)` on delete cascade. The primary key becomes `(user_id, item_id)`. The weekly notes row (`journal`) becomes per user automatically. |
| `user.role` | `admin` or `member`, default `member`. |
| `user_settings` | One row per user: which sections are shown, an optional weekly target (for M5), and the time zone. |
| `invite` | id, GitHub username (lower case), pinned GitHub id once used, invited by, created, used at, revoked at. |
| `progress_event` | id, user_id, item_id, kind (`done`, `undone`, `note`, `link`), at. Indexed on `(user_id, at)`. Every save writes one row, inside the same request. It holds no note text, only that a note changed. This is what M5's weekly charts read. |
| `export_token` | For the Claude export: one per user, stored only as a hash, can be revoked. |

**Migration on the live database**, in one transaction:
1. Add `user_id` as nullable.
2. Fill it with the owner's user id, found through the GitHub account whose id is `OWNER_GITHUB_ID`.
3. Check that no row is left empty.
4. Make the column not null and swap the primary key.
5. Set the owner's role to `admin`.

The migration refuses to run if the owner's user can't be found. It is checked first on a Neon branch (a copy of production), with row counts compared before and after.

## 4. Keeping users apart (the most important part)
- **One way in.** Every page, Server Action and API route gets the user id only from the server-side session (`requireUser()`), never from the request body, URL or a cookie value.
- **Every query is scoped.** Data functions take `userId` as a required first argument. No function reads or writes `progress`, `progress_event`, `user_settings` or `export_token` without it.
- **Tests prove it:**
  - a unit test that fails if any query on those tables lacks a user filter
  - for every action and page: user A never sees, lists, exports, ticks or edits user B's data
  - the export endpoint with A's token never returns B's rows
- **Admin pages** check `role = admin` on the server for every request and action.
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
- **`/admin`** for admins only: invites (add, revoke, see who has used one) and a list of users with their last sign-in. Admins see no one else's notes.
- **`/privacy`**, public:
  - what is stored: GitHub name, avatar, email, progress, notes and links
  - where: Neon, Singapore; Vercel
  - that nothing is sold or shared
  - how to export or delete your data
  - who to contact

## 7. Security and limits
- **Rate limits** on sign-in and on saves per user (carried from M3); Vercel firewall rules for the sign-in endpoints.
- **Not-allowed sign-ins** (no invite) create no user, account or session row, as today for non-owners.
- **Logs** never contain note text or emails.
- **Free-plan limits:** check Neon and Vercel again before sending invites (storage, compute hours, function calls). Each user's data is small, a few hundred rows, so dozens of users fit easily.

## 8. Delivery
Two pull requests, each reviewed (code and UX) before merge:
1. **M4a: data and isolation.**
   - The migration and the per-user data layer.
   - `progress_event` logging and `requireUser()`.
   - The cross-user tests.
   - The owner's experience doesn't change.
   - Rehearsed on a Neon branch, then applied to production.
2. **M4b: invites and settings.**
   - Admin invites and `/settings` (sections, export, delete).
   - `/privacy`, invite-only mode switched on, and the per-user Claude export token.

**End-to-end tests** use two made-up seeded users (and an admin), at phone and desktop width.

## 9. Open questions for the owner
1. Invite by GitHub username: OK?
2. Section defaults for other users: does the table in section 5 look right?
3. Google sign-in: in M4b or later?
4. Is a privacy page with you as the contact OK? The contact would be an address you choose, written into the page by you, not by Claude.
5. Name: does it stay "FDE Journey" for everyone?
