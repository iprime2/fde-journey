# FDE Journey web app: design spec (v0.8)

Status: for M1 and later. v0.1 written 2026-11-25 against `PLAN.md` v0.1, which the owner approved on 2026-11-25 (GitHub sign-in for the owner's account only; job applications are the first new section after go-live; four agents plus one skill). v0.2 written 2026-11-25 after the M1 screen review. v0.3 written 2026-11-26 after the M2 screen review. v0.4 written 2026-11-26 for D1 (design refresh), phase 1; the `/login` mockup waits for the owner's approval. v0.4 updated 2026-11-26 after the D1 phase 1 build review, to record what was built and three rulings (see the last bullet below). v0.5 written 2026-11-26 for M4b, against `M4-DESIGN.md` and the owner's decisions of 2026-11-26 (its section 9). v0.6 written 2026-11-26 after the M4b build review. v0.7 written 2026-11-26 after the Courses & badges build review. v0.8 written 2026-11-26 for M5a (Insights), against `M5-DESIGN.md` v0.1.
Read with `.claude/skills/journey-app-dev/SKILL.md`. If this spec and the plan disagree, the plan wins; tell the lead. For M4, `M4-DESIGN.md` is the plan. For Courses & badges, `COURSES.md` is the content plan. For M5, `M5-DESIGN.md` is the plan.

**Changes in v0.8** (M5a Insights, 2026-11-26; designed from the scope and the code, no screens yet)
- New page `/insights`, all of it in the new section 10: layout at 320 to 1920 px, six blocks with their empty states and skeletons, two server-rendered SVG charts (a stacked weekly bar chart and a 26-week calendar heatmap), accessibility for each chart, and all copy.
- **One column, as every other page.** No page-level second column at 1280, 1440 or 1920 px. From `xl`, Current phase and This month share a row, and certification rows sit in two columns inside their card (section 10.1). The "right-hand column on Home from 1440 px" stays under Later: M5a gives Home only a link.
- New tokens (section 10.3): seven chart colours `kind-*` and five heatmap steps `heat-0` to `heat-4`, light and dark, each with its contrast and a colour-blindness check. Nothing else in the palette changes.
- Chart text is HTML, not SVG text, so it keeps the type scale, never drops below 12 px on a phone, and follows text zoom (section 10.4).
- Navigation: **Insights** right after Home in the sidebar, first row of the More sheet on phones; the bottom bar doesn't change. New icon `ChartColumnIcon` (Lucide "chart-column"). Home gets a one-line link under the tiles, "This week: 5 done · 3-week streak" (sections 3.2, 3.5 and 10.7).
- "Show as table" uses a native `<details>`, so the page needs no client code beyond what it already has (section 10.5).
- Open for the lead: certification "days left" needs a machine-readable date in `content/` (none exists today), and the projection's pace uses roadmap tasks only (section 10.9).

**Changes in v0.7** (Courses & badges build review, 2026-11-26; screens `courses-build/courses-*` and `home-*` at 320, 390 and 1280 px, light and dark, made-up owner "Sam Example")
- New page `/courses` (section 5) and its copy (section 8). Always shown, no Settings switch (lead's decision); in the sidebar after Certifications, in the More sheet on phones (sections 3.2 and 3.5).
- Home tiles (section 5): one rule by tile count. With an **odd** count (5 or 7) the roadmap-milestones tile spans two columns so every row fills; with an even count (4 or 6) no tile spans. The 3-tile rule goes (Home always has at least 4 tiles now). The Home skeleton draws the 7-tile layout from the same grid helper (section 4, Skeleton). Tile progress bars sit at the bottom of the tile, so bars line up when a label wraps (StatTile).
- StatusChip gains a **tag** variant (outlined) for attributes that are not a status: "Badge" uses it. "Top pick" is no longer a chip: it becomes the bold start of the why line, "Top pick for the FDE role: …". Status chips stay filled; tags are outlined, so nothing that isn't done can look "Complete" (section 4).
- Phase chips and phase filter options use short phase names ("Phase 6 · AWS") so no chip wraps inside itself at 320 px; chips never wrap internally, the chip row wraps between chips (sections 4 and 5).
- Toolbar: an optional third select for a page's own filter (Courses only). Below `md` it takes a full row; from `md` it sits in the one row at its natural width. Label "Filter by badge, top pick or phase" (section 4).
- Courses copy reviewed (section 8): facts, card titles and sub lines, top-pick reasons, note placeholder, filter label and sources rewritten where needed; description and Home tile label approved as built.
- Recommended, for the lead: a locked "Always on" Courses row in Settings, so nobody looks for a switch that isn't there (section 5, `/settings`).
- More sheet: a maximum height with its own scroll, so all rows stay reachable in phone landscape now that the owner's sheet has one more row (section 3.1).
- Admin Sign-up (section 5, *Sign-up*, and section 8): leading zeros refused, an unchanged cap isn't saved, the saved notice names both values, and a "Cap" fact comes first in the facts row.

**Changes in v0.6** (M4b build review, 2026-11-26)
- Hidden sections (lead's decision): a section the person switched off **themselves** opens normally from a link, with an info banner "You've hidden {Section} from your menu." and the link "Turn it back on in Settings". A **locked** Scaler section (no access code) stays not-found. Not-found inside the app frame gets its own layout, with no second lockup (sections 5 and 6).
- Recorded as built, with copy approved or rewritten (sections 5 and 8): the Scaler access code cards (Settings and the admin Sign-up tab), the Claude export keys card, "The queue" heading, the new audit sentences, the "reactivated onto the waitlist" and "is now an admin" banners, and the Add-an-admin messages.
- Switch gains a **locked by code** state: "Locked" with a lock icon instead of a disabled switch (section 4).
- Admins: the chooser for a GitHub username several people share (section 5). The `settings.manage` permission now also sets the Scaler code, so its label becomes "Change the user cap and Scaler code" (section 8).
- Claude export keys: show the export address with a Copy button, and the time on each key row, so two keys made on the same day can be told apart (section 5).
- Accessibility: names of repeated row buttons, and where focus goes when a control removes itself (section 7).
- Audit log: two more filter options, and wording that covers people's own actions, not only admins' (sections 5 and 8).
- Privacy page: restore history stated as 6 hours (the lead read it from the Neon project settings on 2026-11-26); Vercel's log retention left without a number; the owner-access sentence rewritten; export keys, Scaler access and the audit log added to what's stored and who sees it; a rule for "Last updated" (sections 5 and 8).
- Earlier open questions that `M4-DESIGN.md` section 10 settled are written in as decisions.

**Changes in v0.5** (M4b: capped sign-up, waitlist, suspended accounts, settings, privacy page, admin dashboard)
- Principles: two rules for a multi-user app (section 1): private by default, and nothing is destroyed by one tap.
- New tokens `danger-ink` and `danger-hover` for the filled destructive button, with contrast rows (sections 2.1 to 2.3).
- Navigation (new section 3.5): hidden sections leave the sidebar and the bottom bar; the bar shows Home, the first three visible sections and More. Settings and Admin sit in a second group in the sidebar and in the More sheet; the account panel keeps Sign out only. Admin shows only to admins.
- Admin tables become cards below 1280 px (`xl`), not 1024 px (section 3.4).
- New components (section 4): Switch, Dialog (confirm and typed confirm), DataTable with its phone CardList, AdminTabs, PlaceInLine; Button gains `danger`, `danger-secondary` and `sm`; StatusChip gains a `danger` variant and the user status labels; StatTile gains a plain (not a link) variant.
- New pages (section 5): `/login` in `capped` mode (plus the suspended error and a privacy link), `/waitlist`, `/settings`, `/privacy`, and `/admin` with six tabs. Home and the section pages respect hidden sections.
- New states (section 6), accessibility rows (section 7), and all new copy, including the `capped` entry for `ACCESS_COPY` (section 8). Ideas that are not in M4 are under Later.
- Mockups (static HTML, made-up people) for the key screens; the lead has the paths.

**Changes in v0.4** (D1 phase 1: logo, sign-in page, account menu, breakpoints)
- New logo and app icon (section 9, Brand). The sidebar and the not-found page show the lockup (mark plus "FDE Journey") instead of the eyebrow and the app name.
- `/login` redesigned (section 5): a split screen from 1024 px (brand panel plus sign-in card), a compact header above the card below 1024 px. Button "Continue with GitHub". Messages move above the button. The access line lives in one constant, so open or invite-only sign-up later changes one line (section 8).
- New tokens: a fixed dark brand panel (`brand-*`, the same in both schemes), `radius-xl` (16 px), `shadow-raised` (light only, sign-in card only), and the type tokens `hero`, `title-lg` and `wordmark` (section 2).
- Motion: two allowed exceptions, both only under `motion-safe`: the example path draws in once on `/login`, and a spinner turns on loading buttons (section 2.5).
- Account area with the GitHub avatar (new Avatar and AccountMenu components, sections 3 and 4). On desktop it replaces the bare Sign out at the foot of the sidebar. On phone it sits in the More sheet, above the Sign out button.
- Responsive rules for 320 to 1920 px and phone landscape (new section 3.4). Line lengths are now capped in `em`, not `ch`: in Inter, `65ch` measured 86 characters per line and `75ch` measured 101. Certification cards go to two columns only from 1280 px. The bottom bar pads for left and right safe areas, and gets a compact form on short landscape screens.
- Button: the loading state keeps full opacity (section 4).
- After the build review (2026-11-26): the brand panel uses one left edge for the lockup, headline, points and example path (the build was better than the mockup, which offset the pitch about 20 px); not-found and the error page are top-aligned at every width, like `/login` below 1024 px; Avatar initials skip leading punctuation and words with no letter or number, and a missing name shows "GitHub user" with the user icon; new token `brand-chip`; card positions re-measured on the build (section 5).

**Changes in v0.3** (from the M2 screen review)
- Closing the note editor always closes it; anything not saved stays visible in the collapsed row with its own action (NoteEditor, "Closing with unsaved changes"). The preview shows what was typed.
- Offline: ticks stay disabled, but note and Weekly notes fields stay editable; their changes wait and save by themselves when the connection returns ("Not saved yet. Saves when you're back online."). The save-failed banner is hidden while offline (sections 4, 6, 8).
- Read-only fields (signed out) keep full-contrast text instead of the 0.5 opacity look, so notes stay readable (NoteEditor).
- "Try again" and other inline text buttons get a 44 px tall hit area; after Try again, focus moves to a control that stays on screen (shared rules, ItemRow, NoteEditor, JournalEditor).
- Live regions announce "Saved" and problems, not "Saving…" (NoteEditor).
- Phone layout: `scroll-padding-bottom` so focus never hides under the bottom bar (section 3.1).
- ResourceList is a button disclosure, as built (it replaced `<details>`). Banner actions that navigate are links.
- NotePreview grid placement spelled out; new copy for note and link limits; contrast rows for `danger` and `warn` on `sunk`.

**Changes in v0.2** (from the M1 screen review)
- Toolbar: the status filter takes its natural width; search placeholders are short enough to fit 150 px (sections 4 and 8).
- "Clear search and filter" moves focus to the search field (Toolbar, EmptyState).
- Card heads keep the chip and count in one group that never splits (Card).
- CollapsibleCard is now an `h2` with a button and a stretched hit area, replacing `<details>`/`<summary>`. The stored open state wins once anything is stored.
- Focus ring: never transitioned (no `outline-color` transitions); inset by 2 px on bottom-bar cells; the page `h1` is `w-fit` (sections 2.5, 3.1, 4).
- New SkipLink component.
- States: the first-visit banner is hidden while the read-only banner shows; the skeleton covers only the toolbar and cards (section 6).
- Reading: "This week" only during that paper's 7-day window.
- Not found uses the `/login` layout plus the app name.
- NoteButton and NoteEditor arrive in M2.
- The 44 px rule applies to controls; text links in rows follow WCAG 2.5.8.
- Copy: "Nothing marked done yet."; row meta and why lines capped at 75ch; `/login` M1 banner text and an M1-only "Go to Home" link.
- Later: open the new current Scaler module once.

**What is live when.** Every component below is built in M1 with all its states, so M2 only wires up saving. Exception: NoteButton and NoteEditor are built in M2, with all their states; M1 shows no note controls, only NotePreview.

| Milestone | Works | Shown but not working yet |
|---|---|---|
| M1 (read-only parity) | Navigation, search, status filter, open and close modules and resource lists, summary tiles, current-phase panel, next class, countdown | Tick boxes and weekly notes are shown disabled. No note buttons yet. A "read-only preview" banner explains why (section 6). The sign-in button is disabled |
| M2 (sign-in and saving) | Ticks, notes (NoteButton, NoteEditor), links, weekly notes, resource ticks, sign-in and sign-out | |

## 1. Principles

1. **Phone first, thumb first.** Most ticks happen on a phone after a class or a reading session. Navigation sits at the bottom of the screen, and every control has at least a 44 px target.
2. **Where am I, and what's next?** Home opens with the current phase, the next class and the countdown. Every section and card shows its done count.
3. **Same tracker, new home.** Keep the teal identity, the three typefaces, the card-and-list layout and today's wording. The owner should not have to relearn anything.
4. **Never lose work quietly.** Every save shows its status. A failed save is visible, says what to do, and keeps the text that was typed.
5. **Calm and dense.** About 400 items live in long lists. Keep the chrome quiet: no shadows on cards, no decoration, mono type for numbers only. The one exception is `/login`, the front door: it carries the brand (dark panel, example path, a soft card shadow in light mode) so the app reads as a product. None of that crosses into the signed-in pages.

From M4b other people sign in too, so two more rules apply to every new screen:
- **Private by default, and say so where it matters.** Each person sees only their own tracker. Admin screens show counts and dates, never notes, links, Weekly notes or email addresses, and every admin page says this in its header, so an admin never wonders what they might be seeing. The privacy page is one tap away from sign-in, Settings and the waitlist.
- **Nothing is destroyed or given away by one tap.** Deleting an account, leaving the waitlist, suspending someone, removing an admin, changing permissions and raising the cap (which lets people in) each ask for confirmation in a Dialog that says exactly what will happen. Deleting an account also asks for the GitHub username. Everyday changes (ticks, section switches, letting one person in) stay one tap, as today.

## 2. Design tokens

### 2.1 Colour
The tracker's palette is kept. Changes: light `accent-soft` is lightened so teal text on it passes (the tracker's `#dcf1ec` gives 4.46:1, below 4.5). Five tokens are new: `hover`, `line-strong`, `accent-hover`, `danger` and `danger-soft`. `page` is the tracker's `--bg`, renamed so the Tailwind class reads `bg-page`.

| Token | Light | Dark | Role |
|---|---|---|---|
| `page` | `#f3f6f5` | `#0e1412` | Page background |
| `surface` | `#ffffff` | `#151d1a` | Cards, sidebar, bottom bar, fields |
| `sunk` | `#eaefed` | `#1b2521` | Resource lists, progress track, neutral chip, skeleton |
| `hover` (new) | `#eef3f1` | `#1f2a26` | Hover background for nav items and ghost or secondary buttons |
| `ink` | `#14201c` | `#e4ece9` | Main text |
| `muted` | `#5a6a64` | `#93a39d` | Meta, descriptions, placeholders, done titles, counts |
| `line` | `#d9e1de` | `#27332f` | Card borders and row dividers (decorative only) |
| `line-strong` (new) | `#74847e` | `#667872` | Borders of fields, tick boxes and secondary buttons |
| `accent` | `#0b7a68` | `#3fcfb3` | Links, eyebrow, progress fill, focus ring, checked box, current nav |
| `accent-hover` (new) | `#096a5a` | `#5fdcc3` | Primary button on hover |
| `accent-ink` | `#ffffff` | `#06211b` | Text and tick mark on `accent` |
| `accent-soft` | `#e2f4ef` (was `#dcf1ec`) | `#143a32` | "Complete" chip, "Edit note" button, current nav item |
| `warn` | `#9a5600` | `#f0b35a` | "Behind" chip, warning banner text |
| `warn-soft` | `#fbeed8` | `#3a2b13` | Warning banner and chip background |
| `danger` (new) | `#b42318` | `#ff958a` | "Not saved", field errors |
| `danger-soft` (new) | `#fdeceb` | `#3d1915` | Error banner background; "Suspended" chip; hover of the `danger-secondary` button |
| `danger-ink` (v0.5) | `#ffffff` | `#2a0a07` | Text on a filled `danger` button |
| `danger-hover` (v0.5) | `#912018` | `#ffb1a8` | Filled `danger` button on hover |

The filled `danger` button appears only as the confirm button inside a destructive Dialog (section 4), so red stays rare. Everywhere else a destructive action is a `danger-secondary` button (red text and border on `surface`).

Dark mode follows the system setting (`prefers-color-scheme`). Set `color-scheme: light dark` so native controls match, and add `<meta name="theme-color">` for both schemes (`page` values).

**Brand panel tokens (new in v0.4).** Used only by the `/login` brand panel from 1024 px. They have **the same value in both schemes**: the panel is always dark, in light mode too, so the mint accent always sits on dark (the research pattern "dark branding sidebar"). Nothing interactive sits on the panel; if a link is ever added there, its focus ring uses `brand-accent`.

| Token | Both schemes | Role |
|---|---|---|
| `brand-panel` | `#0c1f1a` | Panel background (plus a decorative glow and dot grid, section 5) |
| `brand-card` | `#12302a` | Example-path card on the panel |
| `brand-ink` | `#e8f0ed` | Wordmark, headline, labels in the example path |
| `brand-muted` | `#a3b8b1` | Value points, caption, percentages |
| `brand-accent` | `#3fcfb3` | Logo mark, walked part of the path, check icons, chip text (same as dark `accent`) |
| `brand-faint` | `#5d7c74` | Route not walked yet (dashed), upcoming node ring |
| `brand-line` | `#2a4a42` | Example-card border (decorative) |
| `brand-chip` (as built) | `#143a32` | Background of the "Example" chip (the dark `accent-soft` value, fixed so it stays the same in light mode) |

The "Example" chip on the panel uses `brand-accent` text on `brand-chip`.

**Chart tokens (new in v0.8).** Seven `kind-*` colours for the weekly chart and five `heat-*` steps for the activity calendar, used only on `/insights` (section 10.3 has the values, contrast and the colour-blindness check).

### 2.2 Contrast
Computed with the WCAG 2.x formula (relative luminance with sRGB linearisation, ratio = (L1 + 0.05) / (L2 + 0.05)) on 2026-11-25. Text needs 4.5:1. Field borders, tick boxes, focus rings and the progress fill need 3:1 (WCAG 1.4.11).

| Kind | Foreground | Background | Used for | Light | Dark |
|---|---|---|---|---|---|
| Text | `ink` | `page` | Page text | 15.41 | 15.50 |
| Text | `ink` | `surface` | Card text, item titles | 16.76 | 14.29 |
| Text | `ink` | `sunk` | Text in resource lists, info banner | 14.42 | 13.11 |
| Text | `ink` | `hover` | Hovered nav item | 14.94 | 12.33 |
| Text | `ink` | `accent-soft` | Current nav item | 14.70 | 10.39 |
| Text | `muted` | `page` | Descriptions, facts labels | 5.25 | 7.07 |
| Text | `muted` | `surface` | Meta, placeholders, done titles, nav labels | 5.71 | 6.52 |
| Text | `muted` | `sunk` | Meta in resource lists, neutral chip | 4.91 | 5.98 |
| Text | `muted` | `hover` | Count on hovered nav item | 5.09 | 5.62 |
| Text | `muted` | `accent-soft` | Count on current nav item | 5.01 | 4.74 |
| Text | `accent` | `page` | Eyebrow, links on the page | 4.83 | 9.57 |
| Text | `accent` | `surface` | Links on cards, current bottom-bar item | 5.25 | 8.82 |
| Text | `accent` | `sunk` | Links in resource lists | 4.52 | 8.09 |
| Text | `accent` | `accent-soft` | "Complete" chip, "Edit note" button | 4.61 | 6.42 |
| Text | `accent-ink` | `accent` | "Current" chip, primary button | 5.25 | 8.69 |
| Text | `accent-ink` | `accent-hover` | Primary button on hover | 6.52 | 10.08 |
| Text | `warn` | `warn-soft` | "Behind" chip, warning banner | 4.95 | 7.36 |
| Text | `warn` | `surface` | Warning text on cards | 5.67 | 9.24 |
| Text | `danger` | `danger-soft` | Error banner | 5.75 | 7.36 |
| Text | `danger` | `surface` | "Not saved", field error | 6.57 | 8.11 |
| Text | `danger` | `sunk` | "Not saved" and tick errors in resource lists | 5.66 | 7.44 |
| Text | `warn` | `sunk` | "Not saved yet" in resource lists | 4.88 | 8.48 |
| UI | `line-strong` | `surface` | Field and tick-box border on cards | 3.93 | 3.68 |
| UI | `line-strong` | `page` | Field border on the page | 3.61 | 3.99 |
| UI | `line-strong` | `sunk` | Tick-box border in resource lists | 3.38 | 3.37 |
| UI | `accent` | `page` | Focus ring on the page | 4.83 | 9.57 |
| UI | `accent` | `sunk` | Focus ring in lists, progress fill on its track | 4.52 | 8.09 |

Brand and logo pairs (v0.4, computed 2026-11-26 with the same formula; brand tokens are the same in both schemes, so one number):

| Kind | Foreground | Background | Used for | Ratio |
|---|---|---|---|---|
| Text | `brand-ink` | `brand-panel` | Wordmark, headline | 14.77 |
| Text | `brand-muted` | `brand-panel` | Value points | 8.19 |
| Text | `brand-ink` | `brand-card` | Path labels, card title | 12.23 |
| Text | `brand-muted` | `brand-card` | Percentages, caption | 6.78 |
| Text | `brand-accent` | `#143a32` | "Example" chip | 6.42 |
| UI | `brand-accent` | `brand-panel` | Logo mark, check icons | 8.79 |
| UI | `brand-accent` | `brand-card` | Walked path, done nodes | 7.28 |
| UI | `brand-faint` | `brand-card` | Dashed route, upcoming node (the figure is decorative and `aria-hidden`, but it still reaches 3:1) | 3.10 |
| UI | `accent` | `page` | Logo mark on the page (light / dark) | 4.83 / 9.57 |
| UI | `#ffffff` | `#0b7a68` | Mark on the app icon tile | 5.25 |
| UI | `#0b7a68` | `#dee1e6` / `#202124` / `#35363a` | App icon tile on typical light and dark browser tab strips | 4.01 / 3.06 / 2.30 (the white mark carries it on the darkest strip) |
| Text | `accent` | `accent-soft` | Avatar initials (light / dark) | 4.61 / 6.42 |

`brand-line` on `brand-card` (1.46) and `brand-panel` against the dark `page` (1.09) are decorative only.

M4b pairs (v0.5, computed 2026-11-26 with the same formula):

| Kind | Foreground | Background | Used for | Light | Dark |
|---|---|---|---|---|---|
| Text | `danger-ink` | `danger` | Filled destructive button ("Delete my account" in the Dialog) | 6.57 | 8.66 |
| Text | `danger-ink` | `danger-hover` | The same, on hover | 8.66 | 10.57 |
| Text | `danger` | `surface` | `danger-secondary` button text, "Leave the waitlist" | 6.57 | 8.11 |
| Text | `danger` | `danger-soft` | `danger-secondary` on hover, "Suspended" chip, Dialog error | 5.75 | 7.36 |
| Text | `danger` | `page` | Field error under a field on the page | 6.05 | 8.80 |
| Text | `warn` | `warn-soft` | "Waitlisted" chip | 4.95 | 7.36 |
| Text | `accent` | `hover` | Current AdminTabs link on hover (light / dark) | 4.68 | 7.61 |
| UI | `danger` | `surface` | `danger-secondary` button border | 6.57 | 8.11 |
| UI | `line-strong` | `surface` | Switch off: track border and thumb | 3.93 | 3.68 |
| UI | `accent` | `surface` | Switch on: track | 5.25 | 8.82 |
| UI | `accent-ink` | `accent` | Switch on: thumb and its check mark | 5.25 | 8.69 |

Courses & badges pairs (v0.7; no new tokens, values from the tables above):

| Kind | Foreground | Background | Used for | Light | Dark |
|---|---|---|---|---|---|
| Text | `ink` | `surface` | "Badge" tag chip; "Top pick for the FDE role:" lead-in | 16.76 | 14.29 |
| Text | `muted` | `sunk` | Phase chip (neutral) | 4.91 | 5.98 |
| UI | `line-strong` | `surface` | Tag chip outline (decorative: the text carries the meaning) | 3.93 | 3.68 |

Lowest text pair: 4.52 (light `accent` on `sunk`). Lowest UI pair: 3.10 (`brand-faint` on `brand-card`, decorative figure), then 3.37 (dark `line-strong` on `sunk`). `line` on `surface` is 1.33 (light) and 1.31 (dark); it is only used for decorative dividers and must never be the only border of a control. Disabled controls are exempt from contrast rules but must still look disabled (section 4).

### 2.3 Tailwind setup
Tokens live as CSS variables, so components never need `dark:` variants for colour. Clear Tailwind's default palette so only these colours exist.

```css
/* web/app/globals.css (sketch) */
@import "tailwindcss";
:root {
  color-scheme: light dark;
  --page:#f3f6f5; --surface:#ffffff; --sunk:#eaefed; --hover:#eef3f1;
  --ink:#14201c; --muted:#5a6a64; --line:#d9e1de; --line-strong:#74847e;
  --accent:#0b7a68; --accent-hover:#096a5a; --accent-ink:#ffffff; --accent-soft:#e2f4ef;
  --warn:#9a5600; --warn-soft:#fbeed8; --danger:#b42318; --danger-soft:#fdeceb;
  --overlay-shadow: 0 8px 24px rgb(0 0 0 / 0.14);
  --raised-shadow: 0 1px 2px rgb(16 40 34 / 0.05), 0 12px 32px rgb(16 40 34 / 0.08);   /* v0.4, sign-in card only */
  /* v0.4 brand panel: same in both schemes, so not repeated in the dark block */
  --brand-panel:#0c1f1a; --brand-card:#12302a; --brand-ink:#e8f0ed; --brand-muted:#a3b8b1;
  --brand-accent:#3fcfb3; --brand-faint:#5d7c74; --brand-line:#2a4a42; --brand-chip:#143a32;
}
@media (prefers-color-scheme: dark) { :root {
  --page:#0e1412; --surface:#151d1a; --sunk:#1b2521; --hover:#1f2a26;
  --ink:#e4ece9; --muted:#93a39d; --line:#27332f; --line-strong:#667872;
  --accent:#3fcfb3; --accent-hover:#5fdcc3; --accent-ink:#06211b; --accent-soft:#143a32;
  --warn:#f0b35a; --warn-soft:#3a2b13; --danger:#ff958a; --danger-soft:#3d1915;
  --overlay-shadow: 0 8px 24px rgb(0 0 0 / 0.5);
  --raised-shadow: none;   /* the card's border is enough on dark */
} }
@theme {
  --color-*: initial;   /* drop Tailwind's default palette */
  --font-display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 12px; --radius-xl: 16px;
}
/* v0.4: add to @theme inline: --color-brand-panel … --color-brand-line (var() of each),
   and --shadow-raised: var(--raised-shadow). */
/* v0.5: --danger-ink:#ffffff; --danger-hover:#912018 in :root, and
   --danger-ink:#2a0a07; --danger-hover:#ffb1a8 in the dark block; add
   --color-danger-ink and --color-danger-hover to @theme inline. */
@theme inline {
  --color-page: var(--page); --color-surface: var(--surface); --color-sunk: var(--sunk); --color-hover: var(--hover);
  --color-ink: var(--ink); --color-muted: var(--muted); --color-line: var(--line); --color-line-strong: var(--line-strong);
  --color-accent: var(--accent); --color-accent-hover: var(--accent-hover); --color-accent-ink: var(--accent-ink); --color-accent-soft: var(--accent-soft);
  --color-warn: var(--warn); --color-warn-soft: var(--warn-soft); --color-danger: var(--danger); --color-danger-soft: var(--danger-soft);
  --shadow-overlay: var(--overlay-shadow);
}
```

### 2.4 Typography
Load fonts from npm in the root layout, one import per weight (`import "@fontsource/inter/400.css";` and so on), using the static `@fontsource` packages already pinned in `web/package.json` (5.3.0). Never `next/font/google` or a Google Fonts link. Load only the weights below; a missing weight makes the browser fake it.

| Role | Package | Weights to import | `font-family` | Fallback |
|---|---|---|---|---|
| Display (headings, app name) | `@fontsource/space-grotesk` | 600 | `"Space Grotesk"` | `ui-sans-serif, system-ui, sans-serif` |
| Body | `@fontsource/inter` | 400, 500, 600 | `"Inter"` | `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` |
| Mono (numbers, counts, dates, chips) | `@fontsource/jetbrains-mono` | 500, 600 (the M1 skeleton imports only 500; add `600.css`) | `"JetBrains Mono"` | `ui-monospace, SFMono-Regular, Menlo, monospace` |

| Token | Font | Size / line height | Weight | Use |
|---|---|---|---|---|
| `display` | Display | `clamp(1.75rem, 1.4rem + 1.2vw, 2.25rem)` (28 to 36 px) / 1.1, tracking -0.01em | 600 | Page `h1` |
| `title` | Display | 18 px / 1.3 | 600 | Card `h2`, phase name in the current-phase panel |
| `body` | Body | 15 px / 1.55 | 400 | Default text |
| `body-strong` | Body | 15 px / 1.55 | 500 | Item titles, nav labels, buttons |
| `input` | Body | 16 px / 1.5 | 400 | All fields. 16 px stops iOS Safari zooming on focus |
| `small` | Body | 13 px / 1.45 | 400 | Meta, descriptions, previews, banners, "why" lines |
| `tab-label` | Body | 12 px / 1.2 | 500 | Bottom-bar labels |
| `label` | Mono | 12 px / 1.3, uppercase, tracking 0.08em | 600 | Eyebrow, kickers, chips, group labels, fact labels |
| `num` | Mono, tabular figures | 13 px / 1.4 | 500 | Counts ("3/7"), date ranges, item index |
| `num-lg` | Mono, tabular figures | 26 px / 1.2 | 600 | Tile numbers |
| `hero` (v0.4) | Display | `clamp(2rem, 1.2rem + 1.6vw, 2.5rem)` (32 to 40 px) / 1.15, tracking -0.02em, `text-wrap: balance` | 600 | `/login` headline on the brand panel only |
| `title-lg` (v0.4) | Display | 24 px / 1.25, tracking -0.01em | 600 | Sign-in card `h1` |
| `wordmark` (v0.4) | Display | 18 px (below 1024 px and in the sidebar) or 20 px (brand panel) / 1, tracking -0.01em | 600 | "FDE Journey" in the lockup (section 9) |

Nothing smaller than 12 px. Body text lines stay under about 75 characters. **v0.4: cap line length in `em`, not `ch`.** Inter's "0" (what `ch` measures) is much wider than an average letter, so on 2026-11-26 `65ch` measured 86 characters per line and `75ch` measured 101. Use `max-w-[34em]` (about 73 characters at any font size) for page descriptions, card sub lines and descriptions, row meta and why lines, note previews, the "Start here" line and the Home footer note. Titles may use the full width.

### 2.5 Spacing, radius, shadow, motion, breakpoints
- **Spacing**: Tailwind's default 4 px scale. Use 4, 8, 12, 16, 20, 24, 32, 40, 64 px only. Card padding 16 px; gap between cards 12 px; gap between page sections 20 px (phone) and 24 px (desktop).
- **Radius**: `sm` 6 px (focus ring, skeleton blocks), `md` 10 px (fields, buttons, resource list box), `lg` 12 px (cards, tiles, panels, sheet, account panel), `xl` 16 px (v0.4: sign-in card and example-path card only), `full` (chips, progress bar, avatar).
- **Shadow**: cards and tiles have none, only a 1 px `line` border. `shadow-overlay` is only for the "More" sheet, the account panel (v0.4) and the focused SkipLink. `shadow-raised` (v0.4) is only for the sign-in card, and is `none` in dark mode.
- **Motion**: 150 ms ease-out for colour changes, 200 ms for caret rotation, 300 ms for progress-bar width. v0.4 adds two exceptions, both `motion-safe` only: on `/login` the walked part of the example path draws in once (900 ms ease-out after 150 ms, `stroke-dashoffset`), and its nodes fade in (200 ms each, staggered 0.2, 0.5 and 0.9 s); a loading button shows an 18 px ring spinner (one turn per 800 ms, linear) in place of its icon. Nothing else moves. Colour transitions list their properties (`transition-[color,background-color,border-color]`), not Tailwind's `transition-colors`, which also animates `outline-color` and makes the focus ring fade in from the text colour. The focus ring always appears at once. Under `prefers-reduced-motion: reduce` all of it is off (use Tailwind's `motion-safe:`), including skeleton pulsing.
- **Breakpoints**: Tailwind defaults. Below `lg` (1024 px) is the phone layout; `md` (768 px) and `xl` (1280 px) only change grids and gutters. Layouts must also work at 320 px with no sideways scrolling. Full table in section 3.4.

## 3. Layout

### 3.1 Phone and tablet (below 1024 px)
- Set the viewport to `viewport-fit=cover` (Next.js `viewport` export, `viewportFit: "cover"`) so the safe-area insets below work on phones with a notch.
- No top bar. The page header is the first thing on screen; pad the top with `max(24px, env(safe-area-inset-top))`.
- **Bottom bar**, fixed: `surface` background, 1 px `line` top border, height 64 px plus `env(safe-area-inset-bottom)`. Five equal cells: **Home, Roadmap, Reading, Scaler, More** (v0.5: Home, the first three visible sections and More; section 3.5). Each cell is a 22 px icon above a `tab-label`, the whole cell is the target (at least 48 px tall). Default colour `muted`. Current page: icon and label `accent`, a 3 px by 24 px `accent` pill above the icon, and `aria-current="page"`. Focus ring inset (`outline-offset: -2px`) so the bottom edge of the screen never clips it.
- **More** is a button (`aria-expanded`, `aria-controls`). It opens a sheet above the bar: `surface`, `lg` top corners, `shadow-overlay`, over a scrim of `rgb(0 0 0 / 0.3)`. Rows 52 px tall: Certifications, Projects, Career (v0.5: the visible sections not in the bar, then Settings and Admin; section 3.5), then a divider and the account row (v0.4; it replaces the M2 Sign out row): Avatar, the name and "Signed in with GitHub", and a secondary "Sign out" button (AccountMenu, section 4). It closes on choosing a row, on Escape and on tapping the scrim; focus goes to the first row on open and back to More on close. When the current page is in the sheet, More takes the current style.
- v0.7, **sheet height.** The sheet never runs off the top of the screen: `max-height: calc(100dvh - {bar height} - env(safe-area-inset-bottom) - max(8px, env(safe-area-inset-top)))` (bar height 64 px, or 48 px on short screens), `overflow-y: auto`, `overscroll-behavior: contain`. Why: with Courses the owner's sheet holds Certifications, Courses, Projects, Career, Settings, Admin and the account row, about 422 px tall (estimated from the classes in `BottomBar.tsx`, not measured). On an 844×390 phone in landscape only about 342 px sit above the compact bar, so the top 80 px (Certifications and half of Courses) would be off screen and unreachable. Before Courses it overflowed by about 28 px. Opening the sheet focuses its first row, which scrolls it into view.
- Side padding `max(16px, env(safe-area-inset-left/right))`. Bottom padding 24 px plus the bar height, so the last row is never hidden.
- Set `scroll-padding-bottom: calc(64px + env(safe-area-inset-bottom) + 16px)` on `html` below `lg`, so a control reached with Tab (or scrolled to with `#item-…`) is never hidden under the bar. Without it, the M2 review found 8 of 40 Tab stops on `/roadmap` at 390 px hidden behind the bar (WCAG 2.4.11).

### 3.2 Desktop (1024 px and wider)
- **Sidebar**, fixed on the left, 248 px wide, full height, `surface` with a 1 px `line` right border, padding 24 px by 16 px.
  - Top: the lockup (v0.4, section 9): the 24 px mark in `accent` and "FDE Journey" (`wordmark`, 18 px, `ink`), padding 0 12 px so it lines up with the nav labels. It replaces the eyebrow and app name; the Home page header keeps its eyebrow.
  - Nav: Home, Roadmap, Reading, Scaler course, Certifications, Projects, Career (today's tab order). v0.5: only the visible sections, then a second group with Settings and Admin (section 3.5). v0.8: **Insights** sits right after Home, always shown, with no count (section 10.7). v0.7: **Courses** (label "Courses", the page `h1` is "Courses & badges") sits between Certifications and Projects and is always shown, like Home and Roadmap. Each link is 44 px tall, `md` radius, 20 px icon, label (`body-strong`) and a right-aligned count (`num`, `muted`) as on today's tabs. Hover: `hover` background. Current: `accent-soft` background, `ink` label, `accent` icon, `aria-current="page"`.
  - Bottom, pinned: "Readiness review · N days left" (`small`, `muted`), then a 1 px `line` divider with 8 px above and below it, then the account button (v0.4, AccountMenu, section 4). It replaces the M2 ghost "Sign out" button.
- **Main area**: left margin 248 px; content column at most 960 px wide, centred in the remaining space; padding 40 px top, 32 px sides, 64 px bottom.

Nav counts (same as today's tabs): Roadmap = roadmap tasks done (`l` ids only); Reading = papers and books done; Scaler course = classes done; Certifications = passed of 7; Courses (v0.7) = courses done of 27; Projects = complete of 3; Career = career milestones done. Home has none.

Icons: one set, line style, 1.75 px stroke, always next to a visible label, `aria-hidden`. Suggested `lucide-react` (1.80.0 on npm on 2026-11-25; adding it is the lead's call): house, map, book-open, graduation-cap, award, folder-git, briefcase, ellipsis; v0.7 badge-check for Courses (as built).

### 3.3 Page frame and grid
Every page: page header, banner area, then content. Content is a single column of cards. Grids: summary tiles by tile count (v0.7, section 5, Home: 2 columns below `md`; 3 or 4 from `md` or `xl`); certification cards 1 column below `xl`, 2 from `xl` (v0.4, was `md`; section 3.4); current-phase panel 1 column below `md`, 2 columns (`1.1fr 1fr`) from `md`.

```
390 px (Home)                          1280 px (Home)
+--------------------------------+     +-----------+------------------------------------------+
| AI ENGINEERING & FDE . dates   |     | AI ENG.   |   (content max 960 px, centred)          |
| FDE Journey             (h1)   |     | FDE       |   AI ENGINEERING & FDE . dates           |
| SCALER CLASSES Mon.Wed.Fri ... |     | Journey   |   FDE Journey                    (h1)    |
| NEXT CLASS  Today, 09:00 IST   |     |           |   SCALER CLASSES ..  NEXT CLASS ..  ...  |
| READINESS REVIEW  N days left  |     | > Home    |   [banner, if any]                       |
| [banner, if any]               |     |   Roadmap |   [tile]     [tile]     [tile]           |
| [tile]        [tile]           |     |   Reading |   [tile]     [tile]     [tile]           |
| [tile]        [tile]           |     |   Scaler  |   +-------------------+----------------+ |
| [tile]        [tile]           |     |   Certs   |   | ROADMAP . dates   | UP NEXT THIS   | |
| +----------------------------+ |     |   Projects|   | Phase n . Title   |  PHASE         | |
| | ROADMAP . dates            | |     |   Career  |   | x/y tasks  [bar]  | -> task        | |
| | Phase n . Title [CHIP]     | |     |           |   | SCALER . Module n | -> task        | |
| | ...  UP NEXT THIS PHASE    | |     | N days    |   +-------------------+----------------+ |
| +----------------------------+ |     | Sign out  |   footer note                            |
| Home Roadmap Reading Scaler More     +-----------+------------------------------------------+
+--------------------------------+       248 px
```

### 3.4 Responsive rules (v0.4)
Checked on 2026-11-26 with screenshots of the current app at 320, 390, 844×390, 768, 1024, 1280, 1440 and 1920 px. There was no sideways scrolling at any size; the problems were line length, cramped two-column cards on tablets, and empty space on wide screens.

| Width (example device) | Navigation | Content column | Side gutters | Grids and reflow | Toolbar |
|---|---|---|---|---|---|
| 320 (small phone) | Bottom bar | Full width | `max(16px, safe area)` | Tiles 2 columns; NowPanel 1; certification cards 1; card heads wrap the chip and count group under the title | Wraps: search on its own row, filter under it at natural width |
| 390 (phone) | Bottom bar | Full width | `max(16px, safe area)` | As 320 | One row (search plus filter) |
| 844×390 (phone landscape) | Bottom bar, compact when the screen is under 500 px tall (below) | Full width | `max(16px, safe area)`; the notch is on a side now, so the left and right insets matter | Tiles 3 (from `md`); NowPanel 2; certification cards 1 | One row |
| 768 (tablet portrait) | Bottom bar. The sidebar would leave only 520 px of content | Full width, so 720 px | 24 px from `md` (was 16) | Tiles 3; NowPanel 2; **certification cards 1** (two columns gave 362 px cards: titles on three lines, chips pushed under the sub line) | One row |
| 1024 (tablet landscape, small laptop) | **Sidebar** (248 px) from `lg` | 712 px (1024 − 248 − 2 × 32) | 32 px | As 768; certification cards still 1 (two columns would give 350 px cards) | One row |
| 1280 (laptop) | Sidebar | 960 px, centred in the space right of the sidebar | at least 32 px | **Certification cards 2 from `xl`** (474 px each) | One row |
| 1440 (desktop) | Sidebar | 960 px, centred | auto (about 116 px each side) | As 1280 | One row |
| 1920 (large desktop) | Sidebar | 960 px, centred | auto (about 356 px each side) | As 1280. No two-column dashboard yet: Home fits in about 700 px and has nothing for a second column. Revisit with M5 insights (Later) | One row |

- **Where the bar becomes the sidebar:** at 1024 px (`lg`), as today. Nothing changes at 768 except gutters and grids.
- **Content width:** one 960 px cap for every signed-in page, including on very wide screens, because rows are text and a wider column only spreads the title and its note button further apart. Text inside the column is capped at `34em` (section 2.4), so a row's title can be wide but its meta lines stay readable.
- **Cards:** always one column of cards, except tiles (2, then 3 or 4; v0.7 rule by count in section 5, Home) and certification cards (2 from `xl`). The Home NowPanel goes to 2 columns from `md`. Card heads keep the rule from section 4 (Card): the chip and count group never splits.
- **Tables:** the admin pages (v0.5) are the first. They show as a table from 1280 px (`xl`) and as one card per row below it (DataTable and CardList, section 4). Not from `lg`: at 1024 px the content column is 712 px, and the Users table needs about 900 px. Later tables (for example job applications) follow the same rule unless they fit 712 px.
- **Phone landscape (short screens):** when `(max-height: 500px)` and below `lg`, the bottom bar is 48 px tall plus the safe area, with the icon (20 px) beside the label instead of above it. It keeps the five cells and the current-page pill (on the left of the icon). `scroll-padding-bottom` follows the shorter bar. `/login` hides its tagline at this size (section 5).
- **Safe areas (notched phones):** keep `viewport-fit=cover`. Page and sheet padding already use `max(16px, env(safe-area-inset-*))`. **New:** the bottom bar's list gets `padding-left: env(safe-area-inset-left)` and `padding-right: env(safe-area-inset-right)`, so in landscape the first and last cells stay clear of the notch and the rounded corners; its background still runs to the edges. The More sheet and the account panel stay above the bar, so they inherit its inset.
- **Zoom:** at 200% text zoom on a 1280 px laptop the layout behaves like 640 px (bottom bar), which is supported.

### 3.5 Navigation with chosen sections, Settings and Admin (v0.5)
Every user chooses which sections they see (`M4-DESIGN.md` section 5). New users start with Roadmap, Reading and Certifications; the owner keeps all six. Hidden sections leave the navigation and Home; their pages still open from a direct link (section 5, "Hidden section opened directly").

**Where Settings and Admin live: the sidebar and the More sheet, not the account panel.** A new user must find Settings to turn on Scaler, Projects or Career, so it sits in plain sight with the other destinations, on both phone and desktop, in the same place relative to the sections. The account panel stays a one-action disclosure (Sign out), which keeps its simple, tested pattern (section 4, AccountMenu). The Home first-visit banner also links to Settings (section 8).

*Desktop sidebar (1024 px and wider).*
```
 [mark] FDE Journey
 Home
 Insights                           v0.8, always shown, no count
 Roadmap                4/57
 Reading                1/18
 Certifications          0/7        visible sections only, in today's order
 ------------------------------     1 px line, 8 px above and below
 Settings                           gear icon
 Admin                              shield icon, admins only
            (space)
 Readiness review · 81 days left
 ------------------------------
 (SE) Sam Example            ^      account button, unchanged
```
- The second group is a second `<ul>` inside the same `<nav aria-label="Sections">`, with a 1 px `line` top border (8 px above and below). Its links look and behave like the section links (44 px, 20 px icon, `body-strong`, `aria-current="page"`), with no count. Icons: lucide `settings` and `shield`.
- Settings is current on `/settings`; Admin is current on `/admin` and every `/admin/...` page.
- Admin appears only when the user holds at least one admin permission (section 5, `/admin`). Hiding it is not the protection; every admin page checks on the server.
- The Admin link goes to the first admin page the user may open, in tab order (Overview, Users, Waitlist, Sign-up, Admins, Audit log).
- Height: the owner has seven sections plus Settings and Admin, nine links of 44 px with 4 px gaps. Below about 680 px of window height the list no longer fits with the foot, so the nav part of the sidebar scrolls (`overflow-y: auto`, `min-height: 0`) while the lockup and the foot stay put. Check at 1024×600. v0.7: with Courses the owner has ten links, so the list scrolls below about 730 px of window height. That is handled by the existing scroll (as built in `Sidebar.tsx`); nothing else changes. At 1280×900 all ten fit with room to spare (`courses-1280-light-top.png`).

*Phone and tablet (below 1024 px).*
- **Bottom bar:** Home, then the **first three visible sections** in today's order, then More. Owner: Home, Roadmap, Reading, Scaler, More (unchanged). New user with the defaults: Home, Roadmap, Reading, Certifications, More. With fewer visible sections the bar has fewer cells (at least Home, Roadmap and More); the grid takes as many equal columns as there are cells.
- **More sheet,** top to bottom: the visible sections not in the bar (52 px rows, as today); then a 1 px `line` divider; Settings; Admin (admins only); a divider; the account row (unchanged). When no section is left for the sheet, it starts with Settings. Opening it still focuses the first row.
- More takes the current style whenever the current page is in the sheet, including `/settings` and `/admin/...`.
- A section moving between the bar and the sheet when the user switches sections on or off is expected; the order of sections never changes.
- v0.7, **Courses** counts as a visible section that is always on. Because it comes after Certifications, the bar doesn't change for the owner (Home, Roadmap, Reading, Scaler, More) or for new users (Home, Roadmap, Reading, Certifications, More). Courses is the first row of the sheet for new users and the second for the owner, after Certifications. A user who turns off Reading and Certifications gets Home, Roadmap, Courses and More. None of these cases causes a layout problem except the sheet's height in phone landscape (section 3.1, sheet height). Courses never shows the hidden-section banner and isn't named in the first-visit sentence, because it can't be switched off.
- v0.8, **Insights** is not a section (it has no items and no count), so it never takes a bottom-bar cell. It is the **first row of the More sheet** for everyone, above the sections not in the bar, because it comes right after Home in the sidebar order. Opening the sheet now focuses Insights. More takes the current style on `/insights`. The owner's sheet grows by one 52 px row (about 474 px in all); the v0.7 sheet-height rule already scrolls it in phone landscape. Details in section 10.7.

**Home and section counts.** Sidebar counts, StatTiles and the NowPanel's Scaler part follow the same choices (section 5, Home).

## 4. Components
Shared rules:
- Focus ring: `outline: 2px solid accent; outline-offset: 2px` on `:focus-visible`. Never removed, never transitioned (section 2.5). Exceptions: bottom-bar cells use `outline-offset: -2px` (section 3.1), and the Scaler card head draws the ring for its button (CollapsibleCard).
- Disabled means `opacity: 0.5`, `cursor: not-allowed`, and the native `disabled` attribute.
- Controls (buttons, fields, selects, tick boxes, summaries, nav items, tiles, the skip link) have hit areas at least 44 by 44 px, even when the visible shape is smaller (extend with padding or an inset `::before`).
- Text links inside rows or sentences (item titles, note links, the "Sign in" link in a banner) follow WCAG 2.5.8 instead: at least 24 by 24 px, or spaced so that a 24 px circle centred on each one does not overlap another target. One-line title links are about 19 px tall and pass by spacing.
- Inline text buttons ("Try again", "Fix link", "Fix note") are controls, so they get the 44 px rule: `inline-flex min-h-11 items-center` (the line that holds them grows to 44 px), underlined, `font-sans`, in the colour of their line. M2 built them 18 px tall.
- A control that disappears when it has done its job must move focus first, never leave it on the page body. Each component says where focus goes.

**SkipLink.** "Skip to content", the first focusable element on every page that has the sidebar or bottom bar; it targets `<main id="main">`. Visually hidden until focused (hidden with the `sr-only` technique, never `display: none`). When focused: fixed 12 px from the top and left, above everything (`z-50`), at least 44 px tall (`inline-flex items-center`, padding 0 16 px), `surface` background, 1 px `line-strong` border, `md` radius, `shadow-overlay`, `body-strong` in `accent`. In Tailwind, `focus:not-sr-only` resets padding to 0, so set the padding with `focus:` utilities after it. States: hidden, focused.

**PageHeader.** Optional eyebrow (`label`, `accent`), `h1` (`display`), optional description (`small`, `muted`, `max-w-[34em]`), optional facts. The `h1` gets `tabindex="-1"` so focus can move to it after navigation, and `w-fit` so the focus ring (shown after keyboard navigation only) hugs the title instead of spanning the column. States: default only.

**Facts.** A `<dl>` that wraps: `dt` in `label`/`muted`, `dd` in `small` at weight 500, `ink`. Gap 8 px by 18 px. Loading: `dd` shows "–" until the client has computed it.

**Banner.** Full-width strip, `md` radius, padding 10 px by 14 px, `small` text, optional action after the message: an underlined link at weight 600 when it goes to another page ("Sign in" goes to `/login?next={this page}`), an inline text button when it acts on the page. Variants: info (`ink` on `sunk`, `role="status"`), warning (`warn` on `warn-soft`, `role="status"`), error (`danger` on `danger-soft`, `role="alert"`). Banners have no close button: each goes away when its cause does ("Back online." hides itself after 4 s). Show at most two, highest first: error, warning, info.

**StatTile.** A link card to its section: `surface`, `line` border, `lg` radius, padding 14 px by 16 px. Number (`num-lg`), label (`small`, `muted`), ProgressBar. Hover: border `line-strong`. Focus: ring. Loading: skeleton. Zero is not special: "0/57" and an empty bar.
- v0.7, **bar at the bottom.** Tiles in a row stretch to the same height, but the bar followed the label, so a two-line label ("Courses done · 0 badges earned" at 1280 px, "Scaler classes · now Module 1" at 390 px) put its bar lower than its neighbours' (`home-1280-dark.png`, `home-390-light.png`). Make the tile a column and push the bar down: tile `flex flex-col gap-1` (replacing `grid content-start gap-1`), ProgressBar `mt-auto` inside a wrapper with `pt-1.5` (so the 6 px gap above it stays when the label is the longest in the row). The `li` keeps `grid` so the tile fills its cell.
- v0.5, **plain variant** (admin Overview): the same box as a `<div>`, not a link, so no hover border and no focus. The bar is optional (only "Places taken" has one). When the admin may open the matching tab (for example Waitlist), the tile is a link to it, with the usual hover and focus. The number keeps a visually hidden full reading, for example "42 of 100 places taken".

**ProgressBar.** 6 px tall, `full` radius, `sunk` track, `accent` fill, width animates (motion rule). `aria-hidden="true"` because the number beside it already says the same.

**StatusChip.** `label` type, padding 3 px by 8 px, `full` radius, always has text. Variants: neutral (`muted` on `sunk`), ok (`accent` on `accent-soft`), now (`accent-ink` on `accent`), warn (`warn` on `warn-soft`). Labels: phases Complete / This phase / Behind / Upcoming; modules Complete / Current / In progress / Not started; certifications Passed or their priority (First, Second, Third, Optional, When eligible, Parked); projects Complete / In progress / Not started.
- v0.5: new variant **danger** (`danger` on `danger-soft`). Account labels on admin pages: Active (ok), Waitlisted (warn), Suspended (danger); roles: Owner (now), Admin (neutral). A person can show one status chip and one role chip, in that order.
- v0.7: new variant **tag**, for an attribute of an item that is not its status. Outlined, not filled: `bg-transparent text-ink ring-1 ring-inset ring-line-strong` (an inset ring, so the chip keeps the same size as the filled ones; in forced-colours mode the ring disappears but the text stays, which is enough). Used for "Badge" on Courses & badges. **Rule: filled chips (ok, now, warn, danger, neutral) are statuses; outlined chips are tags.** `ok` (teal on pale teal) means Complete or Passed and `now` (solid teal) means Current or This phase, so neither may label anything else: a "Badge" in the `ok` style made a course that isn't done look done, and a solid "Top pick" looked like the current item.
- v0.7, **row chips** (chips after the meta and why lines of an ItemRow, Courses only today): `mt-1 flex flex-wrap gap-2`. Each chip is `whitespace-nowrap`; the row wraps between chips, never inside one. Labels must fit the narrowest text column, about 222 px at 320 px wide (24 characters of `label` type at about 8.2 px each, plus 16 px of padding), which is why phase chips use short names (section 5, `/courses`). Drop the `wrap` prop (`text-balance [overflow-wrap:anywhere]`) for row chips; it made "Phase 6 · AWS cloud and deployment" a two-line pill at 390 px (`courses-390-dark-filtered.png`).

**Count.** `num`, `muted`, shown as "3/7"; screen readers get "3 of 7 done" (visible text `aria-hidden`, plus a visually hidden span).

**Card.** `surface`, 1 px `line` border, `lg` radius. Head: padding 14 px by 16 px, wrapping row of [title block: `h2` + sub line] [chip and count group]. The chip and the count sit in one group (`flex items-center gap-3 whitespace-nowrap`) that never splits: beside the title block it aligns with the title's first line (`self-start`), not the middle of a long sub line; when there is no room, the whole group wraps under the sub line, left-aligned. Optional description (`small`, `muted`, padding 0 16 px 12 px). Body: an item list. Empty: not possible (content files always have items); when filtered, the whole card is hidden.

**CollapsibleCard** (Scaler modules). A disclosure made of a heading and a button, not `<details>`/`<summary>`: some screen readers (reported for VoiceOver with Safari) treat a summary like a button and flatten a heading inside it, which would hide the module headings from heading navigation. Never put a heading inside a `<summary>`.

```
<section aria-labelledby="{titleId}" class="card">
  <div class="card-head relative min-h-14">           same layout as the Card head
    <span aria-hidden="true">›</span>                 caret, muted; turns 90° when open
    <div>                                             title block
      <h2 class="type-title">
        <button type="button" aria-expanded="{open}" aria-controls="{bodyId}"
                class="text-left after:absolute after:inset-0 after:content-['']">
          <span id="{titleId}">Module 3 · {title}</span>
        </button>
      </h2>
      <p>{sub line}</p>
    </div>
    [chip and count group]
  </div>
  <div id="{bodyId}" hidden={!open}>item rows</div>
</section>
```
- The button's stretched `::after` covers the whole head, so the full head (at least 56 px tall) is the target. The `h2` and button must not be positioned themselves, so the `::after` sizes to the head.
- Accessible name: the title only ("Module 3 · {title}"), with the state from `aria-expanded`. The sub line, chip and count are read as text after it.
- Focus: the head draws the ring (`.card-head:has(button:focus-visible)`: 2 px `accent`, 2 px offset, `lg` radius); the button draws none of its own.
- Open state: with nothing stored, the current module is open and the rest are closed. Once anything is stored (`localStorage`, key `fde-open-modules`, an array of module numbers, same as today), the stored list wins, including an empty list (all closed). The tracker reopened the current module when the list was empty; the app keeps the owner's choice. A search or filter match inside forces it open while the search or filter is active.
- Optional: `hidden="until-found"` on the body, so the browser's find-in-page can open a closed module (on `beforematch`, open it and store the choice).

**ItemRow** (every task, class, resource, paper, book and milestone). Rows are separated by a 1 px `line` top border. Anchor `id="item-{itemId}"` so "Up next" can link to it.

```
+---------------------------------------------------------------+
| [ ]  Embeddings and vector databases           [ Add note ]  |   desktop: note button on the right
| 44px Embeddings . Qdrant                                     |
|      > Learning resources  x/y                               |
+---------------------------------------------------------------+
```
- Grid: `[44px] [1fr] [auto]`; padding 4 px 16 px 4 px 4 px, so the box lines up with the 16 px card padding. Below `md` the grid is `[44px] [1fr]` and the note button sits under the text, left-aligned.
- Tick box: a real `<input type="checkbox">` styled with `appearance: none`: 20 px square, 2 px `line-strong` border, 5 px radius, centred in a 44 by 44 px `<label>` cell. Checked: `accent` fill and an `accent-ink` tick. Accessible name "Mark done: {title}". It must stay visible in forced-colours mode.
- Text column: optional index (`num`, `muted`: "M1·01", "1.", "Week of 30 Nov"), title (`body-strong`; a link when the item has a URL, `accent`, underline offset 2 px, opens in a new tab with a small "↗" and visually hidden "(opens in a new tab)"), meta (`small`, `muted`), "why" line (`small`, `muted`). Meta and why lines are capped at `max-w-[34em]` (v0.4; was `75ch`); the title can use the full width.
- States: **default**; **done**: box checked, title `muted` with a line-through (links keep their underline); **focus**: ring around the 20 px box; **read-only** (M1, offline, signed out): box disabled. M1 has no note button (NoteButton arrives in M2); offline and signed out keep the note button enabled so notes can still be read (and, offline, written; see NoteEditor); **saving**: none for ticks (they change at once); **save failed**: the tick goes back to its saved value and a line appears under the title in `small` `danger`: "Couldn't save this tick." with a "Try again" inline text button (44 px rule). Pressing Try again moves focus to the tick box first, because the line disappears once the tick saves. Ticks never retry by themselves; **filtered out**: `hidden`.

**NoteButton** (built in M2). Secondary small button: 32 px visible height inside a 44 px hit area, padding 0 12 px, `md` radius, `small` 500. Labels: "Add note" (1 px `line-strong` border, `muted` text), "Edit note" when the note or link fields hold any text, saved or not (`accent-soft` background, `accent` text, no border), "Hide note" while the editor is open. `aria-expanded`, and `aria-controls` pointing at the editor while it is open. While the collapsed row shows an unsaved line (NoteEditor), `aria-describedby` points at that line. Hover: border and text `accent`. Disabled: shared rule.

**NotePreview.** Under the title when the editor is closed and the note or link fields hold text: `small`, `muted`, keeps line breaks, first 220 characters then "…"; the link on its own line, as a link only if it starts with `https://`. It shows what was typed, so an unsaved change is never hidden behind the old text (the line under it says it isn't saved). Placement: the text column, grid column 2; from `md`, columns 2 to the end (`col-start-2 md:col-end-[-1]`). Don't combine `col-start-2` with `col-span-2`: `grid-column: span 2` resets the start, and M2 shipped the preview at the card's left edge on desktop.

**NoteEditor** (built in M2). Opens under the row. A textarea (min 96 px tall, resizes vertically) and a link field (`type="url"`, `inputmode="url"`, placeholder "https://…"), both 16 px, `surface`, 1 px `line-strong` border, `md` radius, padding 10 px 12 px, labels visually hidden: "Note for {title}" and "Link for {title}". A status line under the fields (`num`, at least 44 px tall so Try again fits): "Saving…" (`muted`), then "Saved" (`muted`, clears after 2.5 s), "Not saved." in `danger` with a "Try again" inline text button, or "Not saved yet. Saves when you're back online." in `warn`. Saves 800 ms after typing stops and on blur. Opening it focuses the textarea; Escape closes it and returns focus to the NoteButton. Field errors (link not `https://`, shown on blur when not empty; or a limit the server reports): border `danger`, message under the field (section 8), `aria-invalid` and `aria-describedby`; the other field still saves.
- **Announcements.** One polite live region per note area, present from the first render (empty when there is nothing to say), used whether the editor is open or closed. It announces "Saved", "Not saved.", field problems and "Not saved yet. Saves when you're back online.". "Saving…" is shown but not announced (render it outside the live region), so each save is one word, not two. As built: the live region holds text only and is visually hidden (`role="status"`, `aria-live="polite"`); the visible lines carry the inline buttons, with their words `aria-hidden` so they are not read twice, and each button's `aria-describedby` points at its words. Leaving a field (blur, Hide note, Escape) does not resend text whose save just failed and hasn't changed; Try again, a typing pause or the connection returning does.
- **Try again** saves the note and the link again. It moves focus to the NoteButton first (the status changes to "Saving…" and the button goes away).
- **Offline.** The fields stay editable. A change made while offline, or still unsaved when the connection drops (including a save that was in flight), shows "Not saved yet. Saves when you're back online." When the connection returns, every unsaved or failed note, link and Weekly notes change on the page saves by itself, once; after that, the usual "Saved" or "Not saved." with Try again. Text typed offline is lost if the page is closed or reloaded before then (see Later).
- **Read-only** (signed out while using): fields `readonly`, not `disabled`, so the text can still be selected and copied. Look: `sunk` background, `ink` text at full contrast (no opacity), `line-strong` border, `cursor: default`. The shared 0.5 opacity is not used here: it put note text at 3.25:1 on light and made a saved note look like placeholder text.

*Closing with unsaved changes* (decided 2026-11-26, option (b)). "Hide note" and Escape always close the editor at once, after starting a save of anything changed. The editor never stays open on its own and never reopens itself: a late jump in the layout under the owner's thumb is worse than one extra line. Instead, the collapsed row keeps the problem visible:

```
| [ ]  LLM APIs, streaming and structured outputs           [ Edit note ] |
|      API integration                                                    |
|      Read the streaming guide twice. Next: try the batch endpoint.      |   preview = typed text
|      www.example.com/demo                                               |   not https: plain text
|      Not saved.  Try again                                              |   danger, 44 px line
|      Link not saved. Links must start with https://  Fix link           |   danger, 44 px line
```

| What is not saved after closing | Line under the preview | Colour | Action |
|---|---|---|---|
| The save is still running 1 s after closing (slow first load) | "Saving…" | `muted` | None. Faster saves show no line at all, so a normal close causes no flicker |
| The save failed | "Not saved." | `danger` | "Try again": saves note and link again; moves focus to the NoteButton first; the line shows "Saving…" at once, then goes when saved |
| The link breaks a rule (client check or the server) | "Link not saved." plus the rule, e.g. "Links must start with https://" | `danger` | "Fix link": opens the editor and focuses the link field, error shown |
| The note is too long (server) | "Note not saved. Notes can be up to 10,000 characters." | `danger` | "Fix note": opens the editor and focuses the note |
| Offline | "Not saved yet. Saves when you're back online." | `warn` | None; it saves when the connection returns |
| Signed out while using | "Not saved." | `danger` | None; the error banner has "Sign in" |
| Everything saved | No line | | |

- Placement: under the NotePreview, same column; `small` (the field's own line uses `num`); at most two lines: the save line, then the field line.
- When a save succeeds the line goes without a "Saved" message; the row looking normal is the confirmation.
- Focus: Escape moves focus to the NoteButton, Hide note leaves it there; the NoteButton's `aria-describedby` reads the line ("Edit note, Not saved."). The note area's live region announces a failure that arrives after closing. The page's save-failed banner still appears, and its "use Try again next to it" is now true.
- Reopening the editor shows the typed text and the same status.

**ResourceList** (inside roadmap task rows). A disclosure made of a button and a body, as built in M1 (it replaced the `<details>` of v0.2). The open state is controlled from three places (the stored list, a search or filter that matches inside, and the owner's last click under the current filter), which a native `<details>` makes awkward because its `toggle` event also fires for changes made by code. The button follows the WAI-ARIA disclosure pattern, so nothing is lost for screen readers.
- `<button type="button" aria-expanded aria-controls={bodyId}>` holding the caret (`aria-hidden`, turns 90° when open) and "Learning resources" plus the Count. Accessible name "Learning resources 3 of 10 done". `small` 600 `accent`, at least 44 px tall, `w-fit`, focus ring with `sm` radius. Not inside a heading, and none is needed.
- Body: `<div id={bodyId} hidden={!open}>`: "**Start here:** {text}" (`small`, `muted`, label in `ink`), then a list box (`sunk`, 1 px `line` border, `md` radius) of ItemRows (index "1.", linked title, meta "by · type · length · level", why line).
- Remembered per device (`fde-open-res`). Opens when a search or filter matches inside.
- Optional, as for CollapsibleCard: `hidden="until-found"` on the body, so the browser's find-in-page can reach a closed list (`<details>` gave this in Chrome).

**Toolbar.** One row, gap 8 px: SearchField takes the remaining width (minimum 180 px); StatusFilter takes its natural width (`flex: none; width: auto`, about 128 px with the longest option). At 390 px (358 px of content) that leaves about 170 px for placeholder text, so every placeholder must fit in 150 px at 16 px Inter: one or two words, about 16 characters (section 8). At 320 px the row wraps and the search takes the full width.
- SearchField: `type="search"`, 44 px tall, 16 px text, magnifier icon (decorative), label "Search this page" (visually hidden), placeholder per page (section 8). Matches titles, meta, why lines, resource titles, note text and links. The placeholder is only a hint; the search still covers all of these.
- StatusFilter: native `<select>`, 44 px, label "Show" (visually hidden): All items, Not done, Done, With notes.
- v0.7, **page filter** (optional third select; only Courses & badges has one). A native `<select>` like StatusFilter, 44 px, with a visually hidden label that says what it narrows by, different from "Show" so the two selects can be told apart. First option shows everything. Placement, accepted with one change from the build:
  - From `md`: in the one row, at its natural width (`md:flex-none md:basis-auto`, select `md:w-auto`). With short phase names it is about 210 px wide instead of the build's 330 px, and the row fits in 712 px (1024) and 960 px (1280) with the search taking the rest.
  - Below `md`: on its own full-width row under search and status (wrapper `basis-full`, select `w-full`). At its natural width it left a ragged gap on the right (`courses-390-light-top.png`). At 320 px the toolbar is three rows: search, status at its natural width, then the page filter at full width.
  - Stored in the URL like the others (as built), and included in "Clear search and filter".
- Both stored in the URL (`?q=` and `?status=`, replace, don't push) so reload and Back keep them. A visually hidden live region says "{n} items shown" 400 ms after the last change.
- "Clear search and filter" (in EmptyState) empties both, then moves focus to the search field: the button disappears with the empty state, and focus must not fall back to the page body.

**EmptyState.** Centred `small` `muted` text on `surface` with a 1 px dashed `line` border, `lg` radius, padding 28 px, plus an optional secondary button. Which message shows (section 8): "With notes" and no notes → the no-notes message; "Done", search empty and nothing on the page done → "Nothing marked done yet." (no button); anything else → "Nothing matches this search or filter." with "Clear search and filter".

**Skeleton.** `sunk` blocks with `sm` radius in the shape of the content. It covers only what waits for data: the toolbar block and the cards (Home: six tiles and the panel; v0.7: seven tiles, below).
- v0.7, **Home skeleton.** The tile count depends on the person's sections, which load with the tiles, so the skeleton can't know it. It draws **7 tiles in the 7-tile layout** (the owner's Home, the screen opened most often, and on the slow first load after the database sleeps). For a new user with 5 tiles the panel then moves up by one tile row on phone; that is accepted. Build the skeleton's grid from the same helper as StatTiles (export the class and span function from `home.tsx`, for example `tileGridClass(count)` and `tileSpanClass(count, i)`), so the two can't drift apart again (the build drew 6 tiles in the old 3-column grid). The page header is static, so it renders at once, with Facts showing "–" until the client has computed them. Pulses (opacity 1 to 0.6, 1.2 s) only with `motion-safe`. The wrapper has `aria-busy="true"` and a visually hidden "Loading".

**Button.** 44 px tall, `md` radius, padding 0 16 px, `body-strong`. Primary: `accent` / `accent-ink`, hover `accent-hover`. Secondary: `surface`, 1 px `line-strong` border, `ink`, hover `hover`. Ghost: no border, `muted` text, hover `hover` background and `ink` text. Size `lg` (v0.4, the sign-in button only): 48 px tall, icon 20 px, gap 10 px. Loading: label changes (for example "Opening GitHub…"), `aria-busy`, disabled, but at **full opacity** with `cursor: progress` (v0.4: at 0.5 it looked broken, not busy; override the disabled look when `aria-busy` is set). Under `motion-safe` an 18 px ring spinner (2 px `currentColor` border, one side transparent) replaces the button's icon; with reduced motion the icon stays and the label alone says it is busy. Disabled: shared rule.
- v0.5 variants. **Danger:** `danger` background, `danger-ink` text, hover `danger-hover`; only as the confirm button of a destructive Dialog. **Danger-secondary:** `surface`, 1 px `danger` border, `danger` text, hover `danger-soft` background; it opens a destructive Dialog ("Delete my account", "Leave the waitlist", "Suspend", "Remove", "Remove as admin"). **Size `sm`:** 36 px visible height inside a 44 px hit area (as NoteButton), padding 0 12 px, `small` 500; for row actions in admin tables and cards. Loading and disabled as above, for every variant.

**BrandLockup** (v0.4). The logo mark (inline mono SVG, section 9, `aria-hidden`) beside the wordmark "FDE Journey" (`wordmark`). `flex items-center`, mark 28 px with gap 10 px (`/login` below 1024 px, not found), 32 px with gap 10 px (brand panel), 24 px with gap 10 px (sidebar, wordmark 18 px). Mark colour `accent` (`brand-accent` on the panel); wordmark `ink` (`brand-ink`). The wordmark is text, a `<p>`, never the page `h1`. Not a link on `/login` (it would go to a page that sends you back); in the sidebar it is not a link either, since Home is the first nav item.

**Avatar** (v0.4). A circle, 32 px, `full` radius, `accent-soft` background, a 1 px inset `line` ring (`box-shadow: inset 0 0 0 1px var(--line)`, so light photos keep an edge), `overflow: hidden`. Always `aria-hidden` with `alt=""`: wherever it appears, the name is next to it as text.
- **Initials, always rendered underneath:** first letter of the first and last words of the name, uppercased (`toLocaleUpperCase`); one word gives one letter. Split by grapheme (`Intl.Segmenter` or `Array.from`) so accented letters and non-Latin names work. If the name has no letter or number, show a 18 px line "user" icon instead. Type: Inter 600, 13 px, `accent` on `accent-soft` (4.61 light, 6.42 dark).
  - As built and approved (2026-11-26, `lib/account.ts`): in each word, the first letter or digit counts, so leading punctuation is skipped ("(Sam) Example" gives "SE", "@sam" gives "S"). Words with no letter or digit (an emoji, a dash) are dropped before picking the first and last, so "Sam Example" followed by an emoji still gives "SE". A missing or blank name shows the text "GitHub user" and the user icon, not "GU": made-up initials would look like someone's real ones. Known and accepted: "Sam (she/her)" gives "SS".
- **Photo, on top:** a plain `<img>` (decision below), `position: absolute; inset: 0; object-fit: cover`, `width` and `height` 32, `alt=""`, `decoding="async"`, `referrerPolicy="no-referrer"`. While it loads, the initials show, so there is no blank circle and no layout shift. On `error`, remove the `<img>` (client state); the initials stay.
- **Which URL:** the `user.image` column, used only if it parses as a URL with protocol `https:` and host `avatars.githubusercontent.com`; anything else (null, another host) shows initials. Set the size with `url.searchParams.set("s", "64")` (64 = 32 px at 2x), which keeps GitHub's existing `v=4` parameter. Build the URL on the server, where the session is read.
- **`<img>`, not `next/image` (recommended).** GitHub's avatar service already resizes (`s=64`) and caches the image, so `next/image` would add nothing but cost: it would fetch the photo through the app's own server, use the host's image-optimisation allowance, and keep a copy of a personal photo in the server's image cache. No `next.config.ts` change is needed. ESLint's `@next/next/no-img-element` rule will warn: disable it on that one line with the reason ("tiny external avatar, already sized by GitHub"). If `next/image` is ever wanted, it needs `images.remotePatterns` for hostname `avatars.githubusercontent.com`, pathname `/u/**`.
- States: loading (initials), loaded (photo), failed or missing (initials), no letters (icon).
- Tests and screenshots: made-up names ("Sam Example") and initials, or an abstract generated image served by the test itself; never a real photo or a real GitHub URL.

**AccountMenu** (v0.4). Who is signed in, and Sign out. It reads the session, so it streams in: wrap it in `Suspense` with a skeleton of the same size (a 32 px `sunk` circle plus a 96 by 12 px `sunk` bar in a 52 px row), so nothing jumps when it arrives.

*Desktop (sidebar foot).* A disclosure button and a panel, not an ARIA `menu`: with one action, the menu role's arrow-key model adds nothing, and a disclosure is announced plainly.
```
                        +----------------------------+
                        | Signed in with GitHub as   |   small, muted
                        | Sam Example                |   small 500, ink, wraps
                        |----------------------------|
                        | [->] Sign out              |   44 px row
                        +----------------------------+
 Readiness review · 81 days left
 --------------------------------
 (SE) Sam Example              ^                        52 px account button
```
- Button: full width of the sidebar's inner column, at least 52 px tall, `md` radius, padding 0 10 px, gap 10 px: Avatar, the name (`body-strong`, one line, `truncate`), and a 16 px chevron-up icon (`muted`, decorative; it points down while open). `type="button"`, `aria-expanded`, `aria-controls` = the panel id, and `aria-label="Account: {name}"` (it contains the visible name, so speech input works). Hover and open: `hover` background. Focus: shared ring.
- Truncation needs room to shrink: the foot's grid column must be `minmax(0, 1fr)` and the name `min-w-0 flex-1`. Without it the button grows past the 248 px sidebar (seen in the mockup). The full name shows in the panel and in the accessible name.
- Panel: opens above the button with an 8 px gap, as wide as the button, `surface`, 1 px `line` border, `lg` radius, `shadow-overlay`, padding 6 px, `z-30`. Content: "Signed in with GitHub as" (`small`, `muted`) with the name under it (`small` 500, `ink`, `overflow-wrap: anywhere`), padding 6 px 10 px 8 px, a 1 px `line` divider, then a "Sign out" row: a submit button for the existing sign-out action, 44 px tall, `md` radius, padding 0 10 px, 20 px log-out icon (`muted`) and `body-strong` label, hover `hover`.
- Behaviour: opening moves focus to Sign out. Escape closes and returns focus to the account button. A click outside, or Tab moving focus out of the panel, closes it (as the More sheet does). While signing out: the row reads "Signing out…", `aria-busy`, disabled, full opacity.
- States: default, hover, focus, open, signing out, loading (skeleton). Signed out never shows: those pages redirect to `/login`.
- v0.5: unchanged. Settings and Admin live in the sidebar and the More sheet (section 3.5), not here.

*Phone (More sheet).* Chosen over a header avatar: the More sheet already holds Sign out, and a header avatar would add chrome to every page and need a second menu. The account row sits under the divider, after Career:
```
 (avatar) Sam Example                      [ -> Sign out ]
          Signed in with GitHub
```
- Row at least 60 px tall, padding 8 px 4 px 8 px 12 px, gap 12 px: Avatar (32 px), a text column (name in `body-strong`, up to two lines then an ellipsis with `line-clamp-2`, because a phone has no hover to reveal more; "Signed in with GitHub" in `small` `muted`), then a secondary Button "Sign out" (44 px, 18 px log-out icon, natural width).
- The row itself is not interactive; only the button is. Focus order: Certifications, Projects, Career, Sign out. The sheet's existing rules (focus to the first row on open, Escape, scrim) are unchanged. Signing out: the button reads "Signing out…" (Button loading).

**GroupLabel.** `label`, `muted`, 8 px top margin ("Core modules", "Elective modules"). Hidden when nothing under it matches the filter.

**NowPanel** (Home). A card with two parts. Left: kicker "Roadmap · {phase dates}" (`label`, `muted`), `h2` "Phase {n} · {title}" plus StatusChip, "x/y tasks done" (`num`), ProgressBar; then kicker "Scaler · Module {n}", "{title}: {subtitle}", "x/y classes · next: {class}". Right: kicker "Up next this phase" and the first three tasks not yet done, each a link to `/roadmap#item-{id}` with an `accent` "→". Empty: "All tasks in this phase are done."

**JournalEditor** (Weekly notes on Career). Card head "Weekly notes" with its sub line; one textarea (min 160 px) labelled by the card heading; status line, announcements, offline and read-only behaviour as in NoteEditor (the status line is in the DOM from page load). It never closes, so there is no collapsed state. Try again moves focus to the textarea first.

**SignInCard** (`/login`). See section 5.

**JourneyPreview** (v0.4, `/login` brand panel from 1024 px). A decorative "example path" card: `<figure aria-hidden="true">`, `brand-card` background, 1 px `brand-line` border, `xl` radius, padding 18 px 20 px 16 px, max width 30 rem. Head: "Example path" (Display 600, 15 px, `brand-ink`) and the "Example" chip (StatusChip shape, `brand-accent` on `#143a32`). Then the SVG below, at 100% width. Then the caption "Illustration only. Your own progress shows after you sign in." (`small`, `brand-muted`), so nobody takes the numbers for real progress. The stages and percentages are fixed, made-up and generic; never fill them from the database. Motion as in section 2.5; the screenshot and reduced-motion state is the fully drawn path.
```svg
<svg viewBox="0 0 480 196" font-family="Inter, system-ui, sans-serif">
  <!-- whole route, dashed -->
  <path d="M20 170C70 166 92 150 128 142S200 112 240 102 312 74 348 64 420 38 452 30"
        fill="none" stroke="var(--brand-faint)" stroke-width="2" stroke-dasharray="2 6" stroke-linecap="round"/>
  <!-- walked part: draws in (pathLength about 260) -->
  <path d="M20 170C70 166 92 150 128 142S200 112 240 102"
        fill="none" stroke="var(--brand-accent)" stroke-width="4" stroke-linecap="round"/>
  <circle cx="20" cy="170" r="7" fill="var(--brand-accent)"/>                 <!-- done -->
  <circle cx="128" cy="142" r="7" fill="var(--brand-accent)"/>                <!-- done -->
  <circle cx="240" cy="102" r="14" fill="var(--brand-accent)" opacity=".18"/> <!-- current: halo -->
  <circle cx="240" cy="102" r="7" fill="var(--brand-card)" stroke="var(--brand-accent)" stroke-width="3"/>
  <circle cx="348" cy="64" r="6" fill="var(--brand-card)" stroke="var(--brand-faint)" stroke-width="2"/> <!-- upcoming -->
  <path d="M452 16l2.9 6.6 6.6 2.9-6.6 2.9L452 35l-2.9-6.6-6.6-2.9 6.6-2.9z" fill="var(--brand-accent)"/> <!-- the logo's spark -->
  <!-- labels: 13 px Inter 500 brand-ink; percentage as a tspan dx="6", JetBrains Mono 500 12 px brand-muted -->
  Foundations 100% at (34,190) · Retrieval 100% at (142,166) · Agents 60% at (258,126) · Evals 0% at (362,88) · Ship at (440,56), text-anchor end
</svg>
```

### M4b components (v0.5)

**Switch** (Settings, section choices). A real `<input type="checkbox" role="switch">`, so Space toggles it and screen readers say "on" or "off".
- Look: `appearance: none`, track 44 by 24 px, `full` radius, inside a 44 by 44 px hit area. Off: `surface` track, 2 px `line-strong` border, 16 px `line-strong` thumb on the left. On: `accent` track (no visible border), 16 px `accent-ink` thumb on the right with a 10 px check mark in `accent`, so "on" is not colour alone. Thumb slides 150 ms (`motion-safe` only). Forced colours (Windows high contrast): draw the track with a real `border` and the thumb with a border too, never with a box-shadow alone, so both stay visible; in that mode the on state uses `Highlight` for the track.
- Row: a grid `[1fr] [auto]`, min height 64 px, padding 10 px 16 px, 1 px `line` top border between rows. Left: the `<label>` (`body-strong`) and a description (`small`, `muted`, `max-w-[34em]`), linked with `aria-describedby`. Right: the switch. The whole label is clickable.
- Saving: like a tick (section 4, ItemRow). It changes at once and saves; nothing shows while saving. **Save failed:** it goes back to its saved value and a line appears under the description in `small` `danger`: "Couldn't save this change." with a "Try again" inline text button (44 px rule; focus moves to the switch first). **Offline:** disabled, like ticks. **Locked** (Roadmap): no switch at all; the right column shows "Always on" (`small`, `muted`), so nothing looks broken or disabled.
- v0.6, **locked by code** (Scaler course before the access code is entered): the same idea as Always on. No switch, and not a disabled one: at 0.5 opacity it looked broken, and a disabled control can't say why it's disabled. The right column shows a 16 px lock icon (decorative) and "Locked" (`small`, `muted`), `min-h-11`, aligned like "Always on". Under the description, a second `small` `muted` line: "Enter your access code below to unlock it." Once the code is accepted the row gets its switch, already on, and focus moves to it (as built).
- States: off, on, hover (track border `ink` when off, `accent-hover` when on), focus (shared ring around the track), disabled (offline: shared rule), failed, locked (Always on), locked by code.

**Dialog** (every confirmation in M4b). A native `<dialog>` opened with `showModal()`, so the page behind is inert and Escape works.
```
 +------------------------------------------+
 | Suspend Sam Example?               (h2)  |   title, Display 600 18 px
 |                                          |
 | They're signed out at once and can't     |   body, `body`, ink
 | sign in until someone reactivates them.  |
 | Their progress and notes are kept.       |
 |                                          |
 | [error line, only after a failure]       |   small, danger, role="alert"
 |                       [Cancel] [Suspend] |   secondary + danger
 +------------------------------------------+
```
- Box: width `min(440px, 100% - 32px)`, `surface`, 1 px `line` border, `lg` radius, `shadow-overlay`, padding 24 px (20 px below `md`), grid with 16 px gaps, `max-height: calc(100dvh - 32px)` with its own scroll. Backdrop: `::backdrop { background: var(--scrim) }`. v0.6: `--scrim` is `rgb(0 0 0 / 0.3)` in light and should be `rgb(0 0 0 / 0.6)` in dark; at 0.3 the dark page behind a Dialog barely dims (`m4b-review/settings-revoke-dialog-1280-dark.png`), so the box relies on its 1 px border alone.
- Position: centred. **Typed-confirm dialogs below `md` sit at the top** (`margin-top: max(16px, env(safe-area-inset-top))`), so the on-screen keyboard never covers the field or the buttons.
- Labels: `aria-labelledby` the `h2`, `aria-describedby` the body. The title is a question that names the person or thing ("Suspend Sam Example?"), and the confirm button repeats the verb ("Suspend"), never "OK" or "Yes".
- Buttons: DOM order Cancel, then the confirm button. From `md`: one row, right-aligned, gap 8 px. Below `md`: stacked, full width, in DOM order. Confirm is `danger` for destructive actions (delete, leave, suspend, remove, take away permissions) and primary otherwise (raise the cap, let people in, give permissions).
- Focus: on open, to the field if there is one; otherwise to **Cancel** in destructive dialogs (so a stray Enter does nothing harmful) and to the confirm button in others. Tab stays inside the dialog (native modal behaviour; check in Safari and Firefox, and add a focus loop if either lets Tab reach the page). Escape or Cancel closes and returns focus to the button that opened it. If that button is gone after success (a removed row), focus goes to the next row's first control, or, if there is none, to the card's `h2` (`tabindex="-1"`). A click on the backdrop does nothing (no accidental cancels or confirms).
- **Pending:** the confirm button shows its loading label ("Suspending…"), Cancel is disabled and Escape is ignored until the answer arrives.
- **Error:** the dialog stays open; a line above the buttons in `small` `danger` (`role="alert"`) says what happened (section 8); both buttons work again; focus stays on the confirm button.
- **Success:** the dialog closes, the page updates, and an info banner (`role="status"`) states the result, for example "Sam Example is suspended."
- **Typed confirm** (Delete my account only). Under the body: a label "To confirm, type your GitHub username: **sam-example**" (the username in `num` type, `ink`), then a 16 px text field (`autocomplete="off"`, `autocapitalize="none"`, `spellcheck="false"`). The confirm button stays enabled (a disabled button can't explain itself); pressing it with a mismatch shows the field error "That doesn't match your username. Type sam-example." (`aria-invalid`, `aria-describedby`) and keeps focus in the field. Wherever a username appears in running text (label, error, audit sentences), wrap it in `white-space: nowrap`: in the mockup at 390 px the error broke "sam-example" at its hyphen. Compare trimmed and case-insensitive (GitHub usernames are case-insensitive). Enter in the field presses the confirm button.

**DataTable** (admin pages, 1280 px and wider) and **CardList** (below 1280 px). Render both from the same rows and show one with CSS (`hidden xl:block` / `xl:hidden`), so only one is in the accessibility tree; ids come from `useId`, and tests use role locators.
- Table: inside a Card, full width, `border-collapse: collapse`. `<caption class="sr-only">` that states what is shown, for example "People, newest sign-up first. 3 of 42 shown." Header cells `<th scope="col">` in `label` type, `muted`, left-aligned (numbers right-aligned), padding 10 px 12 px, 1 px `line` bottom border. The person cell of each row is `<th scope="row">`. Rows at least 56 px, 1 px `line` dividers, padding 8 px 12 px, `vertical-align: middle`. Numbers and dates in `num` (tabular). No row hover and no clickable rows: actions are real buttons in the last column.
- Person cell (used in every admin list): Avatar 32 px, then the name (`body-strong`, wraps, `overflow-wrap: anywhere`) and, under it, "@{username}" (`small`, `muted`) as a link to the GitHub profile (opens a new tab, "↗", WCAG 2.5.8 spacing). Never the email.
- CardList: `<ul>` with a visually hidden label matching the caption; each `<li>` is a card (`surface`, 1 px `line`, `lg` radius, padding 14 px 16 px, 12 px gap between cards). Card head: Avatar, name as an `h3` (`body-strong`), "@{username}", and the chips (they wrap under the name when there is no room, as Card heads do). Body: a `<dl>` in two columns from 360 px (`label`/`muted` terms, `small` values), one column below. Actions last, in a wrapping row, `sm` buttons.
- More rows: 50 per page, then a secondary "Show 50 more" button under the list; after it loads, focus moves to the first new row's person link (or its `h3` in CardList).
- States: **loading** (skeleton of the toolbar and five 56 px rows, or five 120 px cards); **empty** (EmptyState with the page's message, section 8); **no matches** (EmptyState "Nobody matches this search or filter." with "Clear search and filter"); **error** (the page error card, section 6); **row pending** (the row's button shows its loading label; other rows stay usable); **row failed** (the Dialog error, or for one-tap actions a `small` `danger` line under the person with "Try again").

**AdminTabs** (top of every `/admin` page). A `<nav aria-label="Admin pages">` with a wrapping row of links, gap 8 px, 16 px under it. Each link: 44 px hit area with a 36 px visible pill, padding 0 14 px, `md` radius, `body-strong`, `ink`; hover `hover`; current `accent-soft` background, `accent` text and `aria-current="page"`. Only the tabs the user has permission for are shown. The Waitlist tab carries a Count of people waiting ("Waitlist 7", `num`, `muted`; read as "Waitlist, 7 waiting"). At 390 px the six tabs wrap to two rows; at 1280 px they fit one.

**PlaceInLine** (`/waitlist`). A `sunk` panel, `md` radius, padding 14 px 16 px: kicker "Your place in line" (`label`, `muted`), the number (`num-lg`, `ink`), and a line under it (`small`, `muted`): "11 people are ahead of you." or "You're next." The number has a visually hidden "Number" before it so it reads "Your place in line: number 12". Loading: skeleton of the same size.

## 5. Pages
Each page has its own `<title>`: "{Page} · FDE Journey" ("FDE Journey" on Home). Order is the same at 390 px and 1280 px unless stated; at 390 px everything is one column.

**`/` Home**
1. PageHeader: eyebrow "AI Engineering & FDE · 24 Nov 2026 – 15 Feb 2027"; `h1` "FDE Journey"; facts "Scaler classes: Mon · Wed · Fri, 09:00–11:30 IST", "Next class: {value}", "Readiness review: 15 Feb 2027 · N days left". At 1280 px the facts sit on one line.
2. Banners.
3. Six StatTiles, in today's order: Roadmap milestones (percent; label "x of y roadmap milestones"), Technical learning, Learning resources studied, Scaler classes (label "Scaler classes · now Module n"), Certifications passed (x/7), Portfolio projects complete (x/3). Links: the first three go to `/roadmap`, then `/scaler`, `/certs`, `/projects`. 2 by 3 at 390 px, 3 by 2 at 1280 px. v0.7: a seventh tile, **Courses done** ("0/27", label "Courses done · 2 badges earned", "1 badge earned" for one), between Certifications and Projects, linking to `/courses`; always shown. Grid in the tile-count rule below.
3a. v0.8: the **Insights link** line, "This week: 5 done · 3-week streak  Insights →", between the tiles and the NowPanel (section 10.7).
4. NowPanel. Stacked at 390 px, side by side at 1280 px.
5. Footer note (`small`, `muted`): "15 Feb 2027 is a portfolio and job-readiness milestone, not a deadline to pass every certification."

Next class (Mon, Wed and Fri, 09:00 to 11:30 IST): "In class now (until 11:30 IST)", "Today, 09:00 IST", or "Mon 30 Nov, 09:00 IST". Countdown: "15 Feb 2027 · N days left", "Today", or "15 Feb 2027 (passed)". Work out "today" and both values in Asia/Kolkata time (the server runs in UTC), and refresh them every minute on the client.

**`/roadmap`**
1. PageHeader: `h1` "Roadmap"; description "Eight phases from 24 Nov 2026 to 15 Feb 2027. Learning resources are tracked separately from roadmap progress."
2. Banners. 3. Toolbar.
4. Eight phase Cards in order: `h2` "Phase {n} · {title}", sub line date range (`num`), StatusChip, Count. Rows: tasks with their tag as meta; a ResourceList under each task that has resources.
5. EmptyState when the filter hides everything.

**`/reading`**
1. PageHeader: `h1` "Reading"; description "One core paper a week, plus books. Tracked separately from roadmap progress."
2. Banners. 3. Toolbar.
4. Card "Research papers" (sub line as today, Count): rows with index "Week of {date}", linked title, meta "{authors} · Core or Optional", and the why line. Add " · This week" to the meta only while today (Asia/Kolkata) falls within the 7 days that start on that paper's week date. Outside those windows no paper is marked. The tracker kept marking the latest past week, even after the last paper week had ended.
5. Card "Books" (sub line as today, Count): linked title, meta "{by} · Core or Optional", why line.

**`/scaler`**
1. PageHeader: `h1` "Scaler course"; description "14 modules: 10 core and 4 electives."; facts "Classes: Mon · Wed · Fri, 09:00–11:30 IST" and "Next class: {value}".
2. Banners. 3. Toolbar.
4. GroupLabel "Core modules", CollapsibleCards for modules 1 to 10; GroupLabel "Elective modules", modules 11 to 14. Card head: `h2` button "Module {n} · {title}", sub "{subtitle} · {months} mo · {k} classes", StatusChip, Count. Rows: index "M{n}·{01}", title, no meta.

**`/certs`**
1. PageHeader: `h1` "Certifications"; description "In the order to take them. A certification counts as passed when its last step is ticked."
2. Banners. 3. Toolbar.
4. Cards in rank order (today's `CERT_ORDER`), 1 column below 1280 px, 2 columns from 1280 px (`xl`). Head: `h2` name, sub "{date} · {status}", StatusChip, Count; description; step rows without meta.

**`/courses`** (v0.7; `<title>` "Courses & badges · FDE Journey"; content from `COURSES.md`, ids `cr{n}`). Always shown; no Settings switch (lead's decision, 2026-11-26). Built like Reading. Order is the same at 390 px and 1280 px.
1. PageHeader: `h1` "Courses & badges"; description (section 8); facts **"Done" "3 of 27"**, **"Badges earned" "1 of 21"**, **"Stated length" "44–49 h (19 of 27 courses)"**. Drop the build's "Courses 27" fact: "Done 3 of 27" already says it, and three facts fit one line at 390 px instead of two. Done and Badges earned show "–" until progress loads (as built).
2. Banners. 3. Toolbar: search ("Search courses…"), the status filter, and the page filter (Toolbar, v0.7) labelled "Filter by badge, top pick or phase", options "All courses", "With a badge", "Top picks", then one per phase that has a course, in phase order, with the **short phase labels** below.
4. Three Cards, one per provider, in `COURSE_GROUPS` order: `h2` title, sub line, Count (no StatusChip in the head). Rows in list order (the id order), each an ItemRow:
   - linked title (new tab, "↗");
   - meta: "{length} · {level}" when the provider gives them ("2–4 h · Intermediate", "67 lessons · 9 h"); no meta line when neither is given;
   - why line, top picks only: "**Top pick for the FDE role:** {reason}." The lead-in is `font-semibold text-ink`, the reason `muted` (the "**Start here:**" pattern of ResourceList). It replaces both the build's "TOP PICK" chip and its "For the FDE role: …" line, which said the same thing twice;
   - row chips (StatusChip, v0.7 row rule): **Badge** (`tag` variant) when the provider awards one, then the **phase** (`neutral`, short label). There is no status chip in a course row; the tick, the line-through and the card Count carry done-ness;
   - NoteButton and NoteEditor, with the course note placeholder (section 8).
5. EmptyState when the filters hide everything.
6. Small print under the cards (`small`, `muted`, `max-w-[34em]`, as built): the "checked on" sentence, then "Sources:" with one link per provider. Link labels match the card titles (section 8).
- **Short phase labels** (chips and filter options; the same words in both so a chip can be matched to its option): "Phase 1 · Foundations", "Phase 2 · RAG", "Phase 4 · Agents", "Phase 5 · Project 2", "Phase 6 · AWS", "Phase 7 · Evaluation", "Phase 8 · Portfolio". The longest, "Phase 1 · Foundations", is about 187 px as a chip and fits the 222 px text column at 320 px. A card's search still matches the full roadmap phase name if the engineer adds it to the row's search text (recommended: keep the full name in `searchExtra`).
- 390 px: the chip row usually fits on one line ("BADGE" plus a phase chip is at most about 252 px of the 292 px column); at 320 px the phase chip moves under Badge as a whole. The NoteButton sits under the text (ItemRow rule). 1280 px: the NoteButton is on the right, chips on one line.
- States: loading (ListSkeleton: toolbar and three cards, as built), offline and signed out as on every section page. First visit: zeros, nothing special.

**`/projects`**
1. PageHeader: `h1` "Projects"; description "Three portfolio projects. A project is complete when every step is ticked."
2. Banners. 3. Toolbar.
4. Three Cards: `h2` name, sub line subtitle, StatusChip, Count, description, step rows.

**`/career`**
1. PageHeader: `h1` "Career".
2. Banners. 3. Toolbar.
4. Card "Career milestones" (sub "Apply while learning; don't wait for every certification.", Count): rows with meta "{date} · {description}".
5. JournalEditor card "Weekly notes" (sub "Blockers, next actions, exam dates, weekly reflections."). It shows under the filters "All items" and "With notes" only, as today.

**`/login`** (no sidebar, bottom bar or skip link; `<title>` "Sign in · FDE Journey"). Redesigned in v0.4. A static mockup with screenshots exists for the owner's review (the lead has the paths); build only after approval.

One DOM for every size; CSS changes how the brand part looks. No text is duplicated between phone and desktop.
```
<main id="main" class="login">
  <div class="brand">                         compact header < 1024 px; dark panel >= 1024 px
    BrandLockup                               <p> wordmark, not a heading
    <div class="pitch">
      <p class="statement">                   tagline (phone) / hero headline (panel)
      <ul class="points">                     panel only
    <figure aria-hidden="true">               JourneyPreview, panel only
  <div class="side">
    <div class="card">                        SignInCard
      <h1>Sign in</h1>
      <p class="sub">                          muted
      <p id="access" class="access">          lock icon + access line (section 8)
      [message banner, only when there is one]
      <form><button aria-describedby="access">Continue with GitHub</button></form>
      <p class="fine">                         what GitHub shares
```

*Below 1024 px (320, 390, 768, phone landscape).* One column, max 400 px, centred. Page `page` background.
1. BrandLockup (mark 28 px, `wordmark` 18 px).
2. Tagline, 8 px below: "From AI engineer to Forward Deployed Engineer, one milestone at a time." (`body`, `muted`, `max-w-[34em]`).
3. SignInCard, 24 px below.
- Padding: top `max(32px, env(safe-area-inset-top))` (64 px from `md`), sides `max(16px, env(safe-area-inset-left/right))`, bottom 40 px. The card is 288 px wide at 320, and nothing scrolls sideways at any width (checked in the mockup at 320, 390, 768 and 844×390).
- Short landscape (`max-height: 500px`): hide the tagline and use 24 px top padding, so the card starts at about y = 90 on an 844×390 screen instead of y = 139, and the button is fully on screen without scrolling.
- The points and the JourneyPreview are `display: none` here (not just visually hidden: they are decoration, and the figure is `aria-hidden` anyway).

*1024 px and wider.* Equal split: `grid-template-columns: minmax(0,1fr) minmax(0,1fr)`, at least `100dvh` tall.
- **Brand panel (left):** `brand-panel` background, padding `clamp(40px, 4.5vw, 64px)`. Decoration, behind the content and `pointer-events: none`: a radial glow (`radial-gradient(60% 50% at 15% 0%, rgb(63 207 179 / .18), transparent 70%)`) and a 24 px dot grid (`rgb(232 240 237 / .09)` 1 px dots), both faded out towards the bottom with a mask (`linear-gradient(to bottom, #000 30%, transparent 95%)`). Content sits in one column, `width: 100%; max-width: 34rem; margin-inline: auto` (so at 1920 px it is centred in the 960 px panel, not stuck to its left edge), flex column with 32 px gaps:
  1. BrandLockup (mark 32 px, `wordmark` 20 px, `brand-ink`, mark `brand-accent`).
  2. Pitch (`margin-top: auto`): the statement in `hero` (`brand-ink`), then 20 px below, three points (`body`, `brand-muted`, 10 px apart, each with an 18 px check icon in `brand-accent`): "Roadmap, classes and certifications in one place", "A note and a link on every step", "Made for your phone and your laptop".
  3. JourneyPreview (`margin-bottom: auto`), so the pitch and the preview sit together in the middle of the panel, under the lockup.
  - **One left edge** (decided 2026-11-26 in the build review): the lockup, the headline, the points and the JourneyPreview all start at the column's left edge. The headline fills the column (no extra max width; it sets in three lines at 1280 and 1920 px). The JourneyPreview is capped at 30 rem and stays left-aligned, so it is narrower than the headline on wide panels. The mockup centred the pitch and preview about 20 px right of the lockup; that offset read as a mistake, and one edge is calmer.
- **Sign-in side (right):** `page` background. `position: sticky; top: 0; height: 100dvh; display: grid; place-items: center; padding: 48px 32px`, so the card stays centred in the window even if the panel is taller than the screen (for example 1024×600).
- Measured in the mockup: card top at 201 px (1024×768), 267 px (1440×900) and 357 px (1920×1080); the panel content fits in 768 px of height. Measured on the build (2026-11-26 screenshots): card top at 276 px (1280×900) and 365 px (1920×1080). The build's card is 16 px shorter than the mockup's because it renders no empty message cell (the mockup doubled the gap above the button), so it sits 8 px lower; that is correct.

*SignInCard.* `surface`, 1 px `line` border, `xl` radius, `shadow-raised` (light only), padding 24 px below 1024 px and 32 px from 1024 px, full width up to 400 px, grid with 16 px gaps.
1. `h1` "Sign in" (`title-lg`).
2. Sub line, 6 px under the heading (a −10 px top margin on the 16 px gap): "Pick up where you left off." (`body`, `muted`).
3. Access line: `small`, `muted` on `sunk`, `md` radius, padding 10 px 12 px, a 16 px lock icon (decorative) and the text from the `ACCESS_NOTE` constant (section 8). It has an `id`; the button's `aria-describedby` points at it, so screen readers hear the rule with the button.
4. Message banner (section 4, Banner), **above the button** (v0.4; it was under it), so the problem is read before the action and stays in view on a phone. Render nothing when there is no message (no empty grid cell, or the gap doubles). `?error=not_owner` gives the "not allowed" error; any other `?error=` gives "Sign-in didn't finish. Try again."; `?status=signed-out` gives the info banner "You're signed out.".
5. Primary Button, size `lg`, full width: the GitHub mark (20 px) and "Continue with GitHub". "Continue" works for signing in today and for a first sign-in once others can join. Loading: "Opening GitHub…" (Button, loading). While the part of the page that reads the address streams in, the button shows disabled at 0.5 with no message (a split second).
6. Fine print under a 1 px `line` divider (padding-top 14 px): "GitHub shares your profile and email address with FDE Journey. It can't post or change anything on GitHub." (`small`, `muted`). This matches Better Auth's default GitHub scopes, `read:user` and `user:email`, which are read-only (checked in `@better-auth/core` on 2026-11-26; `lib/auth.ts` adds no scopes). If scopes are ever added, update this line.

*Light and dark.* The brand panel is dark in both schemes; the right side and the card follow the scheme. In dark mode the card has no shadow, and the panel is told apart from the page by its glow and its slightly greener tone.

*Focus.* Tab order: the GitHub button, then nothing else (the panel has no controls). Focus ring: the shared 2 px `accent` ring (5.25:1 on light `surface`, 8.82:1 on dark). No focus is moved on load, even with an error: the error banner is `role="alert"`, and it is the first thing after the access line. v0.5: the privacy link (below) comes after the button in the Tab order.

*v0.5: `capped` mode (M4b).* The layout does not change. Three things do:
1. **Access line:** "New here? Continue with GitHub to start your own tracker. Places are limited; if they're full you'll join the waitlist." (`ACCESS_COPY.capped`, section 8). At 390 px it sets in four lines in the access box; that is fine. Nobody is turned away for not being allowed, so `capped` has no not-allowed error.
2. **Privacy link** (in every mode, once `/privacy` exists): a line under the fine print, inside the card: "Privacy: what's stored and who sees it" as a `small` link in `accent`, to `/privacy` (same tab). It is the only way to read the privacy page before signing up.
3. **New messages** in the message banner above the button: `?error=suspended` (error, with a link to the GitHub issue page; section 6, Suspended), `?status=deleted` and `?status=left-waitlist` (info). Copy in section 8.
- Where people go after "Continue with GitHub": an active account goes to `next` as today; a new account that gets a place goes to Home (first-visit state); a new account past the cap, or a waitlisted one, goes to `/waitlist`; a suspended one comes back to `/login?error=suspended`. The button and its "Opening GitHub…" state are the same in every case.
- Google sign-in comes after M4 (owner decision, 2026-11-26); see Later for where its button would go.

**Not found** (`not-found.tsx`; no sidebar or bottom bar; `<title>` "Page not found · FDE Journey")
- One centred column, max 400 px (the phone layout of `/login`, at every width; no brand panel). Top-aligned, not centred vertically (decided 2026-11-26): top padding `max(32px, env(safe-area-inset-top))`, 64 px from `md`, gap 24 px between the lockup and the card. The lockup then sits where it sits on `/login` below 1024 px, and a short card floating mid-screen on a laptop added nothing. The top-level error page (`app/error.tsx`) uses the same frame (`CenteredPage`).
- BrandLockup (mark 28 px, wordmark 18 px; v0.4, replacing the eyebrow and app name), so the owner can tell they are still in the app. The top-level error page uses the same header.
- A card with `h1` "This page doesn't exist." (`title` size) and a primary "Go to Home" button.
- **v0.6, inside the app frame.** When a signed-in page calls `notFound()` (a locked Scaler section, an `/admin` page without its permission), the sidebar or bottom bar is already on screen. Today the CenteredPage frame renders inside the content column, so at 1280 px a second lockup appears 120 px right of the sidebar's, and at 390 px the top padding doubles (about 70 px above the lockup). Instead: no lockup, no CenteredPage; the same card (max 400 px) at the top-left of the content column, where a PageHeader would start, with the usual page padding. Same copy, same `<title>` "Page not found · FDE Journey". Screens: `m4b-review/hidden-scaler-1280-light.png`, `hidden-scaler-390-light.png`.

**Home and the section pages with hidden sections (v0.5)**
- **StatTiles:** the three Roadmap tiles always show. The Scaler, Certifications and Projects tiles show only when their section is on. Grid: the v0.7 rule below (it replaces the v0.5 grids for 3 to 6 tiles).
- **Tile grid by count (v0.7).** The three Roadmap tiles and Courses always show, so Home has 4 to 7 tiles: the owner 7; new users 5 (three Roadmap tiles, Certifications, Courses); 4 with Scaler, Certifications and Projects all off; 6 with two of them on. **Rule: with an odd count, the first tile (roadmap milestones, the headline number) spans two columns, so every row fills; with an even count, no tile spans.**

| Tiles | Who | Below `md` (390 px) | From `md` | From `xl` (1280 px) | Classes (`ul`; span on the first `li`) |
|---|---|---|---|---|---|
| 7 | The owner | 2 columns: milestones across both, then 3 rows of 2 | 4 columns: milestones across two plus 2, then 4 | as `md` | `grid-cols-2 md:grid-cols-4`; first `col-span-2` |
| 6 | Two optional sections on | 2 by 3 | 3 by 2 | as `md` | `grid-cols-2 md:grid-cols-3`; no span |
| 5 | New users (default) | 2 columns: milestones across both, then 2 rows of 2 | 3 columns: milestones across two plus 1, then 3 | as `md` (4 columns would leave a hole) | `grid-cols-2 md:grid-cols-3`; first `col-span-2` |
| 4 | All optional sections off | 2 by 2 | 2 by 2 | 4 in a row | `grid-cols-2 xl:grid-cols-4`; no span |

  - Checked on the build's screenshots for 7 (`home-390-light.png`, `home-1280-dark.png`): rows fill, nothing scrolls sideways. At 768 and 1024 px, 4 columns give tiles about 170 px wide; the longer labels set in two lines, which is fine once the bars sit at the bottom (StatTile).
  - **Remove the 3-tile branch** of `TILE_GRID` and `tileSpan`: 3 tiles can't happen while Courses is always on. If a Courses switch is ever added, 3 tiles come back: then milestones across both columns below `md` (the odd rule), one row of 3 from `md` (`md:col-span-1`).
  - The fallback for an unknown count is the 6-tile row (`grid-cols-2 md:grid-cols-3`, no span).
- **NowPanel:** the Scaler part (kicker, module, classes) shows only when Scaler is on; the left column is then the roadmap part alone.
- **Facts:** "Scaler classes" and "Next class" show only when Scaler is on. The readiness review fact stays (it is the roadmap's end date; see open questions about dates for other users).
- **First-visit banner:** when any section is off, it adds a sentence with a link to Settings (section 8).
- **Hidden section opened directly** (v0.6, lead's decision; the M4b build shows not-found for every switched-off section, and the front end changes it):
  - **Switched off by the person themselves** (Reading, Certifications, Projects, Career, and Scaler once unlocked): the page opens and works as usual (ticks, notes, search). Nothing is blocked, because nothing is secret; the choice only tidies the navigation.
  - **Banner:** info variant (`ink` on `sunk`, `role="status"`), in the banner area: under the PageHeader, above the Toolbar, on both widths. Text "You've hidden {Section} from your menu." then the link "Turn it back on in Settings" (underlined, weight 600, to `/settings`). `{Section}` is the nav label: "Reading", "Scaler course", "Certifications", "Projects", "Career". Calm, not a warning: nothing is wrong, the person is only reminded why the page isn't in their menu. It follows the banner order (error, warning, info; at most two), so an offline or save-failed banner comes first. No close button: it goes when the section is switched back on.
  - Because the banner sits in the streamed part (it needs the person's settings), render it as the first thing inside the content's Suspense boundary, above the Toolbar, so the PageHeader still shows at once and nothing jumps above the header.
  - **Navigation:** no nav item is current (the page isn't in the menu), and on a phone More doesn't take the current style either. That's expected; the banner explains it.
  - **Locked Scaler** (no access code entered; never the owner): stays not-found, because the section can't be switched on without the code. It uses the in-app not-found layout above.


**`/waitlist`** (signed in with `status = waitlisted`; `<title>` "Waitlist · FDE Journey"). Every other app page, and Home, redirects a waitlisted user here; `/privacy` and sign-out still work. No sidebar, bottom bar or skip link: the CenteredPage frame of not-found (lockup on top, one column, max 400 px, top-aligned at every width), so 390 px and 1280 px show the same column.
```
 [mark] FDE Journey
 +--------------------------------------+
 | You're on the waitlist         (h1)  |   title-lg
 | +----------------------------------+ |
 | | YOUR PLACE IN LINE               | |   PlaceInLine (sunk)
 | | 12                               | |
 | | 11 people are ahead of you.      | |
 | +----------------------------------+ |
 | FDE Journey has a limited number of  |   body, ink
 | places, and they're all taken. ...   |
 | We don't send email, so check back   |   body, ink
 | here. ...                            |
 | Joined the waitlist on 30 Nov 2026.  |   small, muted
 |--------------------------------------|
 | (SE) Sam Example        [Sign out]   |   account row, as in the More sheet
 |      Signed in with GitHub           |
 |--------------------------------------|
 | [Leave the waitlist]                 |   danger-secondary, natural width
 +--------------------------------------+
   Privacy: what's stored and who sees it      small link, under the card
```
- Card: as SignInCard (`surface`, 1 px `line`, `xl` radius, `shadow-raised` in light only, padding 24 px, 32 px from `lg`), grid with 16 px gaps, dividers as 1 px `line` with 16 px of space each side.
- Order and copy (section 8): `h1`; PlaceInLine; the explanation (they get in when a place opens or the owner adds places, in the order people joined); the check-back line (no email is sent; signing in shows the latest place, and once they're in they go straight to their tracker); the joined date; the account row (Avatar, name, "Signed in with GitHub", secondary "Sign out"); "Leave the waitlist" (`danger-secondary`).
- The place is worked out when the page loads (one plus the number of waitlisted people who joined earlier). The page does not refresh itself; a reload or a later sign-in shows the new place, or goes to Home once they have a place.
- **Leave the waitlist** opens a Dialog (destructive, no typed confirm: only a place in line is lost): title "Leave the waitlist?", body "This deletes your account and your place in line. If you sign in again later, you'll join at the back.", buttons "Cancel" and "Leave the waitlist" (loading "Leaving…"). On success: signed out, `/login?status=left-waitlist`.
- States: loading (PlaceInLine skeleton; the rest is static), offline (warning banner above the card; Leave disabled; Sign out still tries), leave failed (Dialog error).

**Suspended** (no page of its own). A suspended account can't sign in, and its sessions end at once (`M4-DESIGN.md` section 2), so the person only ever sees `/login` with an error banner above the button: "This account is suspended, so it can't sign in. If you think this is a mistake, open an issue on GitHub." The banner's action is a link "Open an issue" to the public repo's new-issue page (opens a new tab, "↗"). The same banner shows after any later sign-in attempt. If a suspension lands while they are using the app, their next save fails with the existing "signed out while using" banner (section 6), and its Sign in link leads to this message.

**`/settings`** (every active user; `<title>` "Settings · FDE Journey"). The usual app frame (sidebar or bottom bar). The content column is capped at **640 px**, left-aligned in the 960 px column: switch rows across 960 px would put each label far from its switch.
1. PageHeader: `h1` "Settings"; description "Choose your sections, download your data or delete your account."
2. Banners (offline, save failed, action results).
3. Card **Sections**: `h2` "Sections", sub line "Choose what shows in your menu and on Home. Hidden sections keep their progress, so you can turn them back on any time." Then six Switch rows in today's order: Roadmap (locked, "Always on"), Reading, Scaler course, Certifications, Projects, Career, each with its description (section 8). Changes apply to the navigation at once. v0.6: until the Scaler access code is entered, the Scaler course row is **locked by code** (Switch, section 4), not a disabled switch. v0.7, recommended (the lead decides; the build has no row): a seventh row, **Courses & badges**, between Certifications and Projects, locked like Roadmap ("Always on", no switch), with the description "Courses from OpenAI and Anthropic, by roadmap phase." The card says it chooses "what shows in your menu and on Home", and Courses is in both, so without a row people may look for a switch that isn't there. It needs no database change.
3a. Card **Unlock Scaler course** (v0.6, as built, `M4-DESIGN.md` 10.2; shown only until Scaler is unlocked, never to the owner). `h2` "Unlock Scaler course" (the build says "Scaler course", the same words as the switch row just above it, so the two read as duplicates). Text (`small`, `muted`, `max-w-[34em]`, also the field's description): "The Scaler course section is for people taking the Scaler course. If you were given an access code, enter it here. You only need to do it once." A label "Access code" (`body-strong`), a 16 px text field (`autocomplete="off"`, `autocapitalize="characters"`, `spellcheck="false"`, max 64 characters) and a secondary Button "Unlock" (loading "Checking…") on one row that wraps. Enter in the field presses Unlock.
   - **Field width:** at most `20em` (about 320 px). As built it stretches to 510 px at 1280 px, which suggests a long text is wanted. The same rule applies to the code field on the admin Sign-up tab.
   - Errors under the field (`small`, `danger`, `aria-invalid`, `aria-describedby`), focus stays in the field: empty, wrong code with the tries left, too many tries, no code set yet, connection (copy in section 8). Five tries an hour; the server counts them.
   - **Success:** the card goes, the Scaler course row gets its switch (on), focus moves to that switch, and the info banner "Scaler course is unlocked and on." shows at the top. The navigation updates at once.
   - Offline: Unlock disabled (shared rule).
4. Card **Your data**: `h2` "Your data"; text "Download everything you've saved: your GitHub profile details, ticks, notes, links, Weekly notes, section choices and activity history. It comes as a JSON file (a plain text format other apps can read)."; a secondary Button with a download icon, "Download my data" (loading "Preparing…"); then the line "Read what's stored and who can see it on the privacy page." with "privacy page" linking to `/privacy`.
   - The file downloads as `fde-journey-data-{YYYY-MM-DD}.json` (date in IST). Failure: a `small` `danger` line under the button, "Couldn't prepare your download. Try again.", with Try again (focus to the button). Offline: the button is disabled.
4a. Card **Claude export keys** (v0.6, as built; `M4-DESIGN.md` 10.4 placed it under Your data). `h2` "Claude export keys" (`tabindex="-1"`, the focus target when the last key goes).
   - Text (`small`, `muted`, `max-w-[34em]`), rewritten (section 8): what a key lets Claude read, that it can't change anything, that a key is shown once, and to revoke unused keys.
   - **Export address** (v0.6, should-fix): the build tells people to use "the export address" but never shows it. Under the text: the label "Export address" (`small`, `muted`), the full address (`https://{host}/api/export`, `num`, `ink`, `overflow-wrap: anywhere`) and a secondary `sm` "Copy" button (accessible name "Copy the export address"; "Copied" for 2 s; on failure select the text and say "Couldn't copy. The address is selected: copy it yourself."). Build the address from the request's host on the server. This is help text for the export endpoint already in the plan, not a new feature; the lead decides.
   - **Key list:** one row per key, 1 px `line` dividers, wrapping: 18 px key icon (`muted`, decorative); "Key created {date}, {time} IST" (`body-strong`) over "Last used today" / "Last used yesterday" / "Last used on 3 Dec" / "Never used" (`small`, `muted`); a `danger-secondary` `sm` "Revoke" (accessible name "Revoke the key created {date}, {time} IST"). **v0.6: add the time.** Two keys made on the same day showed as two identical rows, and the Revoke dialog couldn't say which key it meant (`m4b-review/settings-revoke-dialog-1280-dark.png`). No keys: "No keys yet." (`small`, `muted`).
   - **Create a key:** secondary Button with the key icon, "Create a key" (loading "Creating…"). At the limit the server's message shows under it in `small` `danger`: "You already have {N} keys. Revoke one first."
   - **The new key, shown once:** a `sunk` panel (`md` radius, 1 px `line`, padding 12 px) under the list: label "Your new key" (`body-strong`), the line "Copy it now and keep it somewhere safe. It won't be shown again.", a read-only field holding the key (`num`, selects all on focus, gets focus when the panel opens), a secondary "Copy" ("Copied" after) and a ghost "Done" (closes the panel, focus to Create a key). A status line (`role="status"`) says "Copied to the clipboard." or "Couldn't copy. The key is selected: copy it yourself."
   - **Revoke** opens a destructive Dialog: "Revoke this key?" / "The key created {date}, {time} IST stops working at once, so any Claude session using it can't read your data any more. This can't be undone." / "Cancel", "Revoke" (loading "Revoking…"). Result banner "Key revoked. Anything using it can't read your data any more." Focus moves to the next key's Revoke, or the card's `h2` when none is left.
   - Offline: Create, Copy and Revoke disabled; the list stays readable.
5. Card **Delete account**: `h2` "Delete account"; text "Deletes your account and everything in it: progress, notes, links, Weekly notes, settings and sign-ins. It can't be undone, so download your data first if you want a copy."; a `danger-secondary` Button "Delete my account".
   - It opens a typed-confirm Dialog: title "Delete your account?"; body "This deletes your progress, notes, links, Weekly notes, settings and sign-ins at once. It can't be undone."; the typed field (Dialog); buttons "Cancel" and "Delete my account" (`danger`, loading "Deleting…"). On success the person is signed out and lands on `/login?status=deleted`.
   - **The owner** (super admin) sees the card with the text "The owner's account can't be deleted here." and no button (`M4-DESIGN.md` section 2: the owner can't be deleted from the app).
- **Not in M4b:** the weekly target and time zone (for M5) are left out, not shown as "coming soon"; see Later. (v0.6: the per-user Claude export key is in M4b and has its card, 4a.)
- Card order (v0.6, as built): Sections, Unlock Scaler course (until unlocked), Your data, Claude export keys, Delete account. Card heads: the Sections card sets its sub line right under the `h2`, the other cards leave 12 px between the `h2` and their first paragraph; both are fine, since Sections' sub line is a sub line and the others' text is body.
- 390 px: cards full width, switch rows as specified (the description wraps under the label, the switch stays top-right, aligned with the label's first line). 1280 px: the 640 px column beside the sidebar.

**`/privacy`** (public, no sign-in; `<title>` "Privacy · FDE Journey"). Same page for everyone, with no sidebar or bottom bar, because signed-out visitors and waitlisted users read it too.
- Frame: like CenteredPage, but the column is 640 px wide (text capped at `34em`), top-aligned, same paddings. BrandLockup on top, then the content straight on the page (no card: it is a document), then a "Back to FDE Journey" link (to `/`, which sends signed-out visitors to `/login`).
- Type: `h1` "Privacy" (`display`), "Last updated {date}." (`small`, `muted`), `h2` per section (`title`), `body` paragraphs and lists (disc bullets, 4 px between items), 24 px between sections. Links in `accent`, underlined.
- Content, in this order (exact copy in section 8): In short; What's stored; Where it's stored; Who can see it; What isn't done with it; Download or delete your data; Questions. The "Questions" section ends with a link "Open an issue on GitHub" (new tab, "↗") and the warning that issues are public.
- **"Last updated" (v0.6).** The date the wording last changed, not the build date: change `LAST_UPDATED` in the same commit as any change to the page's text, and set it to the launch date when the reviewed text goes live. Format "Last updated 30 Nov 2026." (the app's date style).
- **Numbers on the page (v0.6).** State only numbers someone has checked, and keep each tied to its source: the 6-hour restore history is Neon's `history_retention_seconds` (21,600) on the production project, read by the lead on 2026-11-26. If that setting changes, the page changes with it. Vercel's log retention has no published number for Hobby, so the page gives none.
- 390 px and 1280 px: the same single column; at 1280 it is centred on the page.

**`/admin`** (admins only). The usual app frame; Admin is current in the navigation. Pages, one per tab, each with its own permission (checked on the server for every request and action):

| Tab | Route | Permission | `<title>` |
|---|---|---|---|
| Overview | `/admin` | `metrics.view` | "Overview · Admin · FDE Journey" |
| Users | `/admin/users` | `users.view` (actions need `users.manage`) | "Users · Admin · FDE Journey" |
| Waitlist | `/admin/waitlist` | `waitlist.manage` | "Waitlist · Admin · FDE Journey" |
| Sign-up | `/admin/sign-up` | `settings.manage` | "Sign-up · Admin · FDE Journey" |
| Admins | `/admin/admins` | `admins.manage` | "Admins · Admin · FDE Journey" |
| Audit log | `/admin/audit` | `audit.view` | "Audit log · Admin · FDE Journey" |

The tab for the user cap is called "Sign-up", not "Settings", so it is never confused with the person's own `/settings`.

Every admin page, top to bottom: AdminTabs; PageHeader with eyebrow "Admin", `h1` the tab name, and the description "Counts and dates only. Notes, links, Weekly notes and email addresses are never shown here."; banners; the tab's content. A user without the page's permission gets the not-found page (a plain "forbidden" would confirm the page exists). `/admin` without `metrics.view` redirects to the first allowed tab.

*Overview* (`metrics.view`)
1. Tiles (StatTile, plain variant): **Places taken** "42/100" with a ProgressBar and the label "places taken · 58 free" (the owner isn't counted); **Waitlist** "7", "people waiting" (a link to the Waitlist tab when allowed); **Active, 7 days** "18", "used the app in the last 7 days"; **Active, 30 days** "35", "used the app in the last 30 days"; **Completed this week** "214", "items marked done since Monday, all users". Grid: below `md` 2 columns with Places taken spanning both; from `md` 3 columns with Places taken spanning two.
2. Card **Sign-ups per week**, sub line "Last 8 weeks. Weeks start on Monday (IST). Includes people who joined the waitlist." A small table (no CardList needed; it fits 358 px): columns "Week of" (`num`, "Mon 23 Nov") and "Sign-ups" (`num`, right-aligned), rows 44 px tall (it is read-only, so the 56 px DataTable rows would only add length), plus a third cell with a decorative bar (`accent` on a `sunk` track, 6 px tall, width relative to the busiest week, `aria-hidden`). Column widths: "Week of" 140 px, "Sign-ups" 96 px, the bar the rest (in the mockup, letting the columns share the width put the number about 430 px from its week at 1280). Newest week first. Caption (visually hidden) "Sign-ups per week, last 8 weeks, newest first".
- 390 px: tiles 2 columns, then the table card. 1280 px: tiles 3 columns (Places taken across two), then the card at full width.
- Empty (nobody else has signed up): the numbers are zeros, and the card shows "No sign-ups yet." instead of the table.

*Users* (`users.view`)
1. Toolbar: SearchField (placeholder "Search people…"; matches name and username) and a "Show" select: All people, Active, Waitlisted, Suspended, Admins. Both in the URL (`?q=`, `?status=`), as on other pages, with the "{n} people shown" live region.
2. DataTable or CardList, newest sign-up first. Columns: **Person** (person cell); **Status** (status chip, plus Owner or Admin chip); **Signed up** ("30 Nov 2026"); **Last active** ("Today", "Yesterday", "3 Dec", or "Never"); **Done** (total in `num`, and under it a `small` `muted` line by section, listing only sections with at least one: "Roadmap 12 · Resources 30 · Reading 3"; nothing done: "0" and "Nothing yet"); **Actions** (`users.manage` only). Column widths at 1280 (960 px card, `table-layout: fixed`): Person the rest (about 270 px), Status 130, Signed up 112, Last active 120 (narrower wraps its header), Done 210, Actions 116. Checked in the mockup: with Person at 220 px a long made-up name wrapped to three lines.
3. Actions: active user: `danger-secondary` `sm` "Suspend"; suspended user: secondary `sm` "Reactivate"; waitlisted user: none here (Waitlist tab). No actions on the owner's row or on your own row.
   - **Suspend** opens a destructive Dialog: "Suspend {name}?" / "They're signed out at once and can't sign in until someone reactivates them. Their progress and notes are kept." / "Cancel", "Suspend" (loading "Suspending…"). Result banner "{name} is suspended."
   - **Reactivate** is one tap (it restores access; nothing is lost). Loading "Reactivating…". Result banner "{name} can sign in again." v0.6, as built (`M4-DESIGN.md` 10.4: reactivating never goes over the cap): when every place is taken, the person goes to the back of the waitlist instead, and the banner says "{name} is reactivated. All places are taken, so they joined the waitlist." Their status chip becomes Waitlisted, so under a "Suspended" filter the row leaves the list; focus then goes to the next row's action, or to the search field when the list is empty.
   - Focus after either: to the row's new button (Reactivate replaces Suspend in the same place, and the other way round).
4. "Show 50 more" when there are more.
- Empty: impossible (the owner is always there). No matches: EmptyState as in DataTable.

*Waitlist* (`waitlist.manage`)
1. Card **Let people in**: line "{free} places free · {waiting} waiting" (`num`); a number field "How many" (16 px, 96 px wide, `inputmode="numeric"`, min 1, max the smaller of free places and people waiting, default the smaller of 5 and that max) and a primary Button "Let them in". It opens a Dialog (primary confirm): "Let in the next 5 people?" / "They get a place in the order they joined. They'll see it the next time they sign in." / "Cancel", "Let them in" (loading "Letting in…"). Result banner "5 people were let in." (the server's count; it can be lower if the queue changed).
   - **No free places:** the line reads "All 100 places are taken." with "Raise the cap in Sign-up to let more people in." ("Sign-up" links to the tab when allowed; otherwise "Ask an admin who can change the cap."). The field and button are disabled.
   - Field error (not a whole number, or out of range): "Enter a number from 1 to {max}."
2. The queue, in order (DataTable or CardList), under the `h2` "The queue" (v0.6, as built and approved: plain, and short enough for a heading; `tabindex="-1"`, the focus target when the list empties). It sits on the page, not in a card, so the CardList cards aren't nested in another card. In CardList the place is the number at the top right of each card; v0.6 nit: show it as "Place 1" (`num`, `muted`), so a lone "1" isn't mistaken for a count. Columns: **Place** (`num`, "1"), **Person**, **Joined** ("30 Nov 2026, 14:05 IST"), **Actions**: secondary `sm` "Let in" (one tap, loading "Letting in…", disabled when no places are free) and `danger-secondary` `sm` "Remove". Caption "Waitlist, in order. 7 people."
   - **Remove** opens a destructive Dialog: "Remove {name} from the waitlist?" / "This deletes their account and their place. If they sign in again, they join at the back." / "Cancel", "Remove" (loading "Removing…"). Result banner "{name} was removed from the waitlist."
   - After Let in or Remove, the row goes; focus moves to the next row's Let in button, or to the card's `h2` when the list is empty.
- Empty: EmptyState "Nobody is waiting."

*Sign-up* (`settings.manage`)
1. Card **User cap**: Facts "Places taken 42", "Free 58", "Waiting 7"; a number field "User cap" (16 px, 120 px wide, `inputmode="numeric"`) with the hint "How many people can have a place. The owner isn't counted. 0 stops new places; everyone new joins the waitlist." (`small`, `muted`, linked with `aria-describedby`); a primary Button "Save cap" (disabled until the value changes; loading "Saving…").
   - **Raising it while people wait** opens a Dialog (primary confirm): "Raise the cap to 120?" / "This lets in the next 7 people from the waitlist, in the order they joined." / "Cancel", "Raise cap". (7 = the smaller of the new free places and the people waiting.)
   - **Lowering it below the places taken** opens a Dialog (primary confirm, nothing is destroyed): "Lower the cap to 30?" / "42 people already have places. Nobody loses theirs, but new sign-ups join the waitlist until fewer than 30 people have places." / "Cancel", "Lower cap".
   - Any other change saves without a Dialog. Result banners (v0.7, replacing "Cap saved: 120 places."): "Cap changed from 100 to 120 places." and, when people were let in, "Cap changed from 100 to 120 places. 7 people were let in." ("1 place", "1 person was let in." for one.) Naming both values makes a wrong save visible at once, and matches the audit sentence "Changed the cap from 100 to 120 …".
   - Field error: "Enter a whole number from 0 to 1,000." (1,000 decided in `M4-DESIGN.md` 10.4).
   - **v0.7, why these changes:** the owner typed 0 into the field holding 100; the cursor was at the start, the field read "0100", it was accepted as 100 and saved, and the banner said "Cap saved: 100 places.", so the mistake wasn't noticed.
   - **Facts (v0.7):** "Cap 100" first, then "Places taken 42", "Free 58", "Waiting 7" (one Facts `<dl>`, which wraps at 390 px). The saved cap always shows beside the field being edited, and taken plus free reads as the cap. It updates from the server after each save. When the cap is below the places taken, Free reads 0.
   - **Checks on Save, in this order** (on the client, which sees the typed text; `saveUserCap` receives a number, so the server keeps only its range check):
     1. **Leading zero:** more than one character and starting with 0 ("0100", "00"): field error "Type the number without a leading 0." (`small`, `danger`, `aria-invalid`, `aria-describedby`; focus stays in the field). A lone "0" is valid.
     2. **Not a whole number from 0 to 1,000:** "Enter a whole number from 0 to 1,000." (unchanged).
     3. **Same as the current cap** (for example "+100" or " 100 "): nothing is saved; the line under the field reads "The cap is already 100." in `small` **`muted`** (not `danger`: nothing is wrong), in a polite live region (`role="status"`), with no `aria-invalid`. It clears when the field changes. The Save button stays disabled until the text differs from the saved value, as built, so this is a fallback; keep comparing the raw text, so "0100" enables Save and reaches check 1 instead of being ignored.
     4. Otherwise the raise or lower Dialog, or a plain save, as above.
2. Card **Scaler access code** (v0.6, as built; `M4-DESIGN.md` 10.2; same `settings.manage` permission). `h2` "Scaler access code". A status line (`small`, `muted`): "A code is set (last changed 26 Nov 2026). Scaler learners enter it in their Settings to unlock the Scaler section." or "No code is set yet, so nobody else can unlock the Scaler section." Then a label "New access code" ("Access code" when none is set), a hint (`small`, `muted`, `aria-describedby`): "6 to 64 letters, numbers or symbols; capitals don't matter. It's stored scrambled and can't be shown again. Changing it doesn't lock out anyone who already unlocked Scaler.", a text field (at most `20em` wide, as in Settings) and a secondary "Save code" (disabled while the field is empty; loading "Saving…"). No Dialog: a new code takes nothing away from anyone.
   - Field error: "Use 6 to 64 letters, numbers or symbols." On success the field empties and the banner "Scaler access code saved. People who already unlocked Scaler keep it." shows.
   - The code is never shown again, so the card has no "current code" line; the admin keeps it where they share it.

*Admins* (`admins.manage`; at first only the owner)
1. Card **Add an admin**: field "GitHub username" and a secondary "Find" button. Found (an active user): a person cell and the permission checkboxes below (all off), with a primary "Make admin" button (disabled until at least one box is ticked). Not found: field error "No active user has that username." Waitlisted or suspended users can't be made admins ("Only people with a place can be admins.").
   - v0.6, the other answers to Find, as built, shown as the field's message (`small`, `danger`, `aria-invalid`; focus stays in the field). Copy in section 8: empty field; the owner; someone who is already an admin (their card is further down); someone waitlisted or suspended (named, so the admin knows they typed the right username).
   - **Several people share the username** (v0.6, back end in `components/admin/AdminsView.tsx`). Usernames are refreshed at each sign-in, so if someone renamed their GitHub account and another person later took the old name, both can hold it until the first signs in again. Only eligible people are listed (active, not the owner, not already admins). As built (`m4b-review/admins-chooser-390-light.png`, `admins-chooser-1280-dark.png`): a divider, the line "Several people have this username. Choose one:", then per person a person cell, "Signed up {date}, {time} IST" and a secondary "Choose" button; at 1280 the date floats in the middle of the row, at 390 it wraps under the name.
     - **Rows** (should-fix): a `<ul>` with 1 px `line` dividers between people. Each row: Avatar, then a text column with the name (`body-strong`), "@{username}" as **plain text, not a link** (the GitHub profile belongs to whoever holds the name today, so the link would open the same page for both and mislead), and "Signed up 26 Aug 2026 · Last active 3 Dec" (`small`, `muted`; last active as on the Users tab); then a secondary `sm` "Choose" on the right (wraps under the text below 360 px). Sort by last active, newest first. `FoundPerson` has `createdAt` but no last-active date today, so this needs a small back-end addition; if the lead skips it, keep "Signed up {date}" and the sign-up order.
     - **Line above** (should-fix): "{n} people have this username. One of them changed it on GitHub and hasn't signed in since. The one who was active most recently probably holds it now." (`small`, `muted`). The person cell alone can't tell two "Pat Example" rows apart; the dates can.
     - **Choose:** accessible name "Choose {name}, signed up {date}" (the build's "Choose {name}" reads the same twice). After choosing, the list goes and the found person shows as usual, with the "Signed up … · Last active …" line kept under their name so the admin can see which one they picked, plus a ghost `sm` "Choose someone else" that brings the list back.
     - **Focus (must-fix):** the build leaves focus on the page body after Choose, because the button it was on is removed. Move focus to the chosen person's first permission checkbox. "Choose someone else" returns focus to the first Choose button.
2. **The owner's card first**, locked: person cell, Owner chip, a 16 px lock icon and "Has every permission. This can't be changed here." No controls.
3. One card per other admin (cards at every width; seven checkboxes don't make a readable table). Head: person cell and an Admin chip. Body: a `<fieldset>` with the legend "Permissions for {name}" (visually hidden; the head shows the name) and seven checkboxes (the 44 px tick cell from ItemRow, label `body-strong`, description `small` `muted`), one column below `md`, two from `md`. Footer: primary "Save changes" (disabled until something changes) and `danger-secondary` "Remove as admin".
   - The permissions, in this order, with plain labels: "See the overview" (`metrics.view`), "See users" (`users.view`), "Suspend and reactivate users" (`users.manage`), "Manage the waitlist" (`waitlist.manage`), "Change the user cap" (`settings.manage`), "See the audit log" (`audit.view`), "Manage admins" (`admins.manage`; shown only to the owner, decided in `M4-DESIGN.md` 10.4). Descriptions in section 8.
   - Ticking "Suspend and reactivate users" also ticks "See users" and disables it while ticked, with the description "Needed to suspend and reactivate users."
   - **Save changes** opens a Dialog that lists the change: "Change {name}'s permissions?" / "Give: See users, Manage the waitlist. Take away: See the audit log." The confirm is `danger` when anything is taken away, primary otherwise; label "Save changes" (loading "Saving…"). Unticking every box and saving is the same as Remove as admin.
   - **Remove as admin** opens a destructive Dialog: "Remove {name} as an admin?" / "They lose every admin permission at once. Their own tracker isn't affected." / "Cancel", "Remove as admin". Their card goes; focus to the next card's first checkbox, or to the "Add an admin" heading.
   - **Make admin** opens a Dialog (primary): "Make {name} an admin?" / "They can: See users, Manage the waitlist." / "Cancel", "Make admin".
- Empty (only the owner): the owner's card, then "No other admins yet." (`small`, `muted`).

*Audit log* (`audit.view`)
1. A "Show" select: All actions, Let in, Removed from waitlist, Suspended, Reactivated, Cap changed, Permissions changed. In the URL (`?action=`). v0.6: add **"Scaler access code"** (`scaler_code_set`, `scaler_code_failed`) and **"Accounts deleted"** (`account_deleted`) after "Permissions changed". The build logs them but has no way to filter them.
2. DataTable or CardList, newest first. Columns: **When** ("3 Dec 2026, 14:05 IST", `num`), **Who** (who did it: name and @username, no avatar, to stay dense), **What** (one plain sentence, section 8, naming the person affected by @username). CardList: the sentence (`body`), then "{who} · {when}" (`small`, `muted`). Caption "Actions, newest first." (v0.6; was "Admin actions, newest first.").
   - v0.6: the log now also records what people do to their own account: a wrong Scaler access code (Who is that person) and deleting an account (Who is "a deleted account", `muted`). The tab keeps its name; the caption and empty text drop "admin" so they stay true.
3. "Show 50 more".
- A person who later deleted their account shows as "a deleted account" (`M4-DESIGN.md` 10.4). No note text, link, email or access code ever appears here (`M4-DESIGN.md` section 3).
- Empty: EmptyState "Nothing recorded yet." (v0.6; was "No admin actions yet.").

*Admin page states:* loading (AdminTabs and PageHeader at once; skeleton for tiles, toolbar and rows); page error (the page error card); offline (warning banner; every action button disabled; lists stay readable); action failed (Dialog error, or the row's failed line); permission removed while the page is open (the action fails with the error banner "You no longer have permission to do this." and the page shows not-found on the next visit).

## 6. States

| State | When | What the owner sees | Behaviour |
|---|---|---|---|
| Read-only preview | M1 only | Info banner on every page: "Read-only preview. Ticks and notes can't be saved yet." | Tick boxes and weekly notes disabled; no note buttons (they arrive in M2). The first-visit banner is not shown. Search, filter, open and close, tiles and countdown work |
| Signed out | Any page without a valid sign-in | Nothing from the page; goes straight to `/login?next={path}` | After sign-in, return to `next`. No flash of content |
| Not the owner | Sign-in with another GitHub account | `/login` with the "not allowed" error above the button | No account is kept for that user |
| Signing in (v0.4) | After pressing "Continue with GitHub" | "Opening GitHub…" with a spinner (motion-safe), full opacity | Button disabled and `aria-busy` until the browser leaves for GitHub |
| Avatar missing or broken (v0.4) | `user.image` empty, not a GitHub avatar URL, or fails to load | Initials on `accent-soft` (Avatar) | No error shown; nothing to fix for the owner |
| Signed out while using | A save is refused for sign-in reasons | Error banner with a "Sign in" link | Write controls disabled; note fields read-only but readable (NoteEditor), so typed text can be copied before leaving. Typed note text stays in place until the page is left |
| First visit, no progress | No progress saved yet | Zeros and empty bars; NowPanel shows today's phase with its first three tasks; info banner on Home only, and not while the read-only banner shows (it asks for ticks that can't be saved yet) | Banner disappears once anything is saved (based on data, not a dismiss) |
| Loading | A page is waiting for data | The page header renders at once (facts show "–" until computed). Skeleton for the rest: toolbar block, then three cards of four rows (Home: six tiles and the panel). After 3 s add the "still loading" line | Navigation stays usable. The free database sleeps after 5 idle minutes, so the first load can be slow |
| Saving | Tick or note change | Ticks change at once; notes show "Saving…" (in a closed row only after 1 s) | Ticks are optimistic |
| Save failed | A save errors while online | Inline message with Try again on the item (in the collapsed row too, NoteEditor) and one error banner for the page | Tick goes back to its saved value; note text is kept and shown. Banner stays until every failed item is saved or the page is left |
| Offline | Browser reports offline | Warning banner. Unsaved notes show "Not saved yet. Saves when you're back online." | Tick boxes disabled; note and Weekly notes fields stay editable and their changes wait. Reading, search and filter work. The save-failed banner is hidden while offline (Try again can't work; the offline banner explains). Back online: info banner for 4 s, tick boxes enabled, waiting and failed note changes save by themselves once; failed ticks keep their Try again |
| Page error | Server error while rendering | Card "This page didn't load." with "Try again" (primary) and "Go to Home" (secondary) | `error.tsx` per route group |
| Not found | Unknown address | The `/login` layout with the app name, then "This page doesn't exist." and "Go to Home" (section 5). v0.6: inside the app frame (signed in), the same card at the top-left of the content column with no second lockup | `not-found.tsx` |
| New user, first visit (v0.5) | First sign-in that gets a place | Home with zeros, Roadmap, Reading and Certifications in the navigation, and the first-visit banner with its Settings sentence | Same as "First visit, no progress"; the banner goes once anything is saved |
| Waitlisted (v0.5) | Signed in with `status = waitlisted` | `/waitlist` only (section 5) | Every app page and Server Action refuses; `/privacy` and sign-out work. Admitted later: the next page load goes to Home |
| Suspended (v0.5) | An admin suspended the account | `/login` with the suspended error and "Open an issue" | Sessions end at once; any sign-in attempt comes back here. Mid-use: the next save shows the "signed out while using" banner |
| Account deleted (v0.5) | After "Delete my account" | `/login` with the info banner "Your account and data are deleted." | Signed out; nothing is left to sign back into. Signing in again creates a new account (and may join the waitlist) |
| Left the waitlist (v0.5) | After "Leave the waitlist" | `/login` with "You've left the waitlist and your account is deleted." | As above |
| Hidden section opened directly (v0.6) | A link to a section the person switched off themselves | The page as usual, with the info banner "You've hidden {Section} from your menu." and the link "Turn it back on in Settings", under the page header (section 5) | Nothing blocked; ticks, notes and search work. No nav item is current. The banner goes when the section is switched back on |
| Locked section opened directly (v0.6) | A link to `/scaler` before the access code is entered (never the owner) | Not found, in the in-app layout (section 5, Not found) | The section can't be switched on without the code, so there is nothing to show or explain here; Settings explains the code |
| Switch save failed (v0.5) | A section choice doesn't save | The switch goes back; "Couldn't save this change." with Try again under it | As a failed tick. The page's save-failed banner shows too |
| Confirm pending, confirm failed (v0.5) | Any Dialog action | Loading label on the confirm button; on failure the Dialog stays open with an error line | Section 4, Dialog |
| Not allowed (admin, v0.5) | An `/admin` page without its permission | The not-found page | The Admin nav item is absent when the user has no permission at all |
| Permission removed mid-use (v0.5) | An admin action is refused for permission | Error banner "You no longer have permission to do this." | The Dialog closes; next visit shows not-found |
| No free places (v0.5) | Places taken equals the cap | Waitlist tab: "All 100 places are taken." with a link to Sign-up; Let in disabled | New sign-ups go to the waitlist |
| Offline (v0.5 pages) | Browser reports offline | The usual warning banner | Settings switches, Download, Delete, Unlock, Create a key, Revoke, and every admin action are disabled; lists and text stay readable |
| Insights with little or no history (v0.8) | A new user, or nothing done in the chart's window | Each block's own empty text, never an empty or all-zero chart (section 10.2) | Tiles show zeros with a hint; charts are replaced by a sentence; the page never looks broken |
| Scaler code wrong or limited (v0.6) | A wrong access code, or five wrong tries in an hour | The field error under "Access code" (section 8) with the tries left | Focus stays in the field. Each wrong try is counted in the audit log, never the code |

## 7. Accessibility
The conventions checklist, applied:

| Check | How it applies here |
|---|---|
| Text contrast at least 4.5:1 | Every text pair in 2.2 passes in both schemes; lowest 4.52. Field borders, tick boxes, focus ring and progress fill are 3:1 or more |
| Visible focus | 2 px `accent` ring with 2 px offset on every interactive element, including disclosure buttons, tiles, nav links, the tick box and the Scaler card heads. It appears at once (no `outline-color` transition), is inset on bottom-bar cells, and hugs the `h1` (`w-fit`) after navigation. Never `outline: none` without a replacement. Below `lg`, `scroll-padding-bottom` keeps the focused control above the bottom bar (section 3.1) |
| Full keyboard use | SkipLink "Skip to content" first on every page, at least 44 px tall when focused. Tab order follows reading order; in a row: tick, title link, note button, note link, Learning resources. Space ticks; Enter and Space open and close disclosure buttons; Escape closes the More sheet and the note editor (focus back to the note button). After client navigation, focus moves to the page `h1`. After "Clear search and filter", focus moves to the search field. After Try again: tick line to the tick box, note to the note button, Weekly notes to its textarea. Focus never falls to the page body |
| Labelled controls | Tick boxes "Mark done: {title}" (contains the visible title). Search, filter, note and link fields have labels (visually hidden is fine). Icon-only controls do not exist; bottom-bar icons sit above visible labels |
| Touch targets at least 44 px | Applies to controls: tick cell 44 by 44; note button, disclosure buttons, fields, select, buttons, inline text buttons (Try again, Fix link, Fix note), nav links, skip link 44 px; Scaler card heads 56 px; bottom-bar cells 48 px; More sheet rows 52 px. v0.5: switches, `sm` row buttons, AdminTabs links, Dialog buttons and number fields 44 px; the "@username" profile links and the privacy links follow WCAG 2.5.8. Text links in rows and sentences follow WCAG 2.5.8 (24 px, or spaced so a 24 px circle on each does not overlap another target); one-line title links pass by spacing |
| Reduced motion | All transitions and the skeleton pulse are off under `prefers-reduced-motion`. So are the v0.4 `/login` path draw-in (shown fully drawn) and the button spinner (the icon stays) |
| Brand and account (v0.4) | Logo marks next to the wordmark are `aria-hidden`; the wordmark is text. The JourneyPreview is `aria-hidden` (its numbers are fake and must not be read out). Avatar images have `alt=""` because the name is beside them. The account button's name is "Account: {name}"; the panel is a disclosure (`aria-expanded`, `aria-controls`), with Escape returning focus to the button. The sign-in button is described by the access line (`aria-describedby`) |
| Structure | Landmarks: `nav` (sidebar or bottom bar, "Sections"), `main`. One `h1` per page; cards use `h2`. On Scaler the `h2` holds the disclosure button; never put a heading inside a `<summary>`. `<html lang="en">` |
| Status messages | Save status, filter result count and banners are announced (`aria-live="polite"`; error banner `role="alert"`). Save status announces "Saved" and problems only, never "Saving…", and never per keystroke (saves wait for an 800 ms pause). Each "Try again" gets `aria-describedby` pointing at its message, so a list of buttons reads "Try again, Couldn't save this tick." rather than many identical "Try again". Counts read as "3 of 7 done" |
| Not colour alone | Chips always carry text; done items have a checked box and a line-through; the current nav item also has a shape (pill or background), not just colour |
| Reflow and zoom | Works at 320 px wide and at 200% text size with no sideways scrolling. Long titles wrap (`overflow-wrap: anywhere` for links and notes) |
| Links that open new tabs | Small "↗" plus visually hidden "(opens in a new tab)"; `rel="noopener noreferrer"` |
| Errors | Field errors are linked with `aria-describedby` and say how to fix them |
| Tables (v0.5) | Every admin table has a `<caption>` (visually hidden, stating what is shown and how it is sorted), `<th scope="col">` headers and a `<th scope="row">` person cell. Below 1280 px the same rows are a `<ul>` of cards with an `h3` per person, and only one of the two is rendered into the accessibility tree. Numbers are right-aligned with tabular figures. Actions are buttons whose names include the person: visible "Suspend", accessible name "Suspend Sam Example" (visually hidden suffix), so a list of buttons is not a list of identical "Suspend" |
| Dialogs (v0.5) | Native `<dialog>` with `showModal()`: background inert, focus kept inside (check Safari and Firefox), Escape closes (except while pending), focus returns to the opener or the documented fallback. `aria-labelledby` the title, `aria-describedby` the body. Initial focus: the field, else Cancel for destructive actions. Errors in the dialog are `role="alert"` |
| Switches (v0.5) | `<input type="checkbox" role="switch">` with a visible `<label>` and its description linked by `aria-describedby`; the state is announced as on or off; "on" also shows a check mark in the thumb, so it is not colour alone. 44 px hit area |
| Admin navigation (v0.5) | AdminTabs is a `nav` labelled "Admin pages" with `aria-current="page"`; the current tab also has a background, not just colour. Each admin page has its own `h1` (the tab name) and `<title>`; focus moves to the `h1` after navigation, as elsewhere |
| Results of actions (v0.5) | Each admin or Settings action ends with an info banner (`role="status"`) that says what happened, and focus goes to a control that is still on the page (section 5 says which). The Users and Audit log filters announce "{n} people shown" or "{n} actions shown" as the Toolbar does |
| Status chips (v0.5) | Active, Waitlisted, Suspended, Owner and Admin always carry text; colour only repeats it |
| Buttons in repeated rows (v0.6) | A button's accessible name must tell its row apart from the others: "Choose Pat Example, signed up 26 Aug 2026" (two people can share a name), "Revoke the key created 26 Nov 2026, 14:05 IST" (two keys can share a day). When a control removes itself (Choose, Unlock, Revoke, Done), focus moves first: Choose to the first permission checkbox, Unlock to the Scaler switch, Revoke to the next Revoke or the card `h2`, Done to "Create a key" |
| Charts (v0.8) | Each chart is one `role="img"` with a short name, followed by a visually hidden summary sentence, and a "Show as table" disclosure with the same numbers. Colour is never the only carrier: bar segments have fixed order and 2 px gaps, the legend lists kinds in stack order, the heatmap has a numeric legend and an outlined "today", and the tables hold everything. No hover, tooltips or focusable marks; no animation in any motion setting. Chart text is HTML, so it stays at least 12 px and follows text zoom (section 10.5) |
| Typed confirm (v0.5) | The username to type is shown as text inside the label, so screen readers hear it with the field. The confirm button stays enabled and explains a mismatch with a field error, instead of being disabled with no reason |

Each check is part of the M1 screen review at 390x844 and 1280x900, light and dark. From D1, screen reviews also cover 320, 768, 1024, 1440 and 1920 px wide and 844×390 (phone landscape), as the plan requires.

## 8. UI copy

**Rules**
1. Plain English, sentence case everywhere (headings, buttons, chips are uppercased only by CSS).
2. Short. Buttons are one to three words and start with a verb: "Add note", "Try again", "Sign in with GitHub".
3. Messages say what happened, then what to do. No blame, no "Oops", no exclamation marks, no emoji.
4. No internal words: not "sync", "session", "database", "server", "request", "item id" or error codes. Say "saved", "signed in", "connection".
5. Define jargon once, where it first appears: the sign-in page spells out "Forward Deployed Engineer" beside the name "FDE Journey" (v0.4 tagline), so later screens can say "FDE". Course and roadmap content keeps its own wording.
6. Dates like the tracker: "Mon 30 Nov", "24 Nov – 1 Dec 2026", "15 Feb 2027". Times in 24-hour IST: "09:00 IST". Numbers as digits.
7. Keep the tracker's labels for anything that already exists, so the owner recognises it.

**Examples** (made-up content where content is needed)

| Situation | Copy |
|---|---|
| Search placeholder, Roadmap (each must fit 150 px at 16 px; see Toolbar) | "Search tasks…" |
| Search placeholder, Reading | "Search papers…" |
| Search placeholder, Scaler | "Search classes…" |
| Search placeholder, Certifications and Projects | "Search steps…" |
| Search placeholder, Career | "Search milestones…" |
| Search placeholder, Courses & badges (v0.7, as built) | "Search courses…" |
| Note placeholder, task | "What did you build or learn? Key takeaways, questions, links…" (today's text; other placeholders also stay as today) |
| Note placeholder, course (v0.7) | "What did you learn? Key points, questions… Put your badge link in the link field." (build: "What did you learn? Key points, and where the badge or certificate lives…": "lives" is vague, it reads oddly on the 6 courses with no badge, and the editor already has a link field for exactly this) |
| Link placeholder | "https://…" |
| No matches | "Nothing matches this search or filter." Button: "Clear search and filter" |
| "With notes" and no notes yet | "No notes yet. Use Add note on any item." (M1, with no note buttons: "No notes yet.") |
| "Done", search empty, nothing on the page done | "Nothing marked done yet." No button |
| First visit banner (Home) | "Nothing ticked yet. Tick items as you finish them and your progress will show here." |
| Read-only preview (M1) | "Read-only preview. Ticks and notes can't be saved yet." |
| Still loading (after 3 s) | "Still loading. The first load after a quiet spell can take a few seconds." |
| Note status | "Saving…" / "Saved" / "Not saved." + "Try again" (the full stop makes it read as two parts: "Not saved. Try again") |
| Note waiting for the connection | "Not saved yet. Saves when you're back online." |
| Collapsed row, link problem | "Link not saved." + the rule, e.g. "Links must start with https://". Button: "Fix link" |
| Collapsed row, note too long | "Note not saved. Notes can be up to 10,000 characters." Button: "Fix note" |
| Note too long (under the field) | "Notes can be up to 10,000 characters." |
| Link too long, or with a user name | "Links can be up to 2,000 characters." / "Links can't include a user name or password." |
| Tick failed (inline) | "Couldn't save this tick." + "Try again" |
| Save failed (banner) | "A change wasn't saved. Check your connection, then use Try again next to it." |
| Link not https | "Links must start with https://" |
| Offline | "You're offline. You can read and search, but changes won't save until you're back online." |
| Back online | "Back online." |
| Signed out while using | "You were signed out, so that change wasn't saved." Action: "Sign in". When a note or Weekly notes change is unsaved on the page: "You were signed out, so that change wasn't saved. Copy any text you typed, then sign in." (signing in leaves the page) |
| Login: heading and sub line (v0.4) | "Sign in" / "Pick up where you left off." |
| Login: tagline and headline (v0.4) | "From AI engineer to Forward Deployed Engineer, one milestone at a time." |
| Login: value points (v0.4, panel only) | "Roadmap, classes and certifications in one place" / "A note and a link on every step" / "Made for your phone and your laptop" |
| Login: button (v0.4) | "Continue with GitHub"; loading "Opening GitHub…" |
| Login: fine print (v0.4) | "GitHub shares your profile and email address with FDE Journey. It can't post or change anything on GitHub." |
| Login: example path (v0.4) | Title "Example path", chip "Example", caption "Illustration only. Your own progress shows after you sign in." |
| Login: not the owner | "This GitHub account can't sign in. FDE Journey is private to its owner for now." (v0.4 wording; v0.3 said "The app is private to its owner.") |
| Login: GitHub failed | "Sign-in didn't finish. Try again." |
| Login: after sign-out | "You're signed out." |
| Account button, accessible name (v0.4) | "Account: {name}" |
| Account panel (v0.4) | "Signed in with GitHub as" + name; "Sign out"; while pending "Signing out…" |
| More sheet account row (v0.4) | Name; "Signed in with GitHub"; button "Sign out" |
| Login: M1 only (sign-in not built yet) | "Sign-in isn't available yet. It comes with saving progress." Link-button: "Go to Home" |
| Not found | "This page doesn't exist." Button: "Go to Home" |
| Example note in screenshots or tests | "Finished the quickstart. Next: try hybrid search on the sample set." with link "https://example.com/demo" |
| Example account in screenshots or tests (v0.4) | Name "Sam Example" (initials "SE"); a long-name case "Samantha Example-Longname"; no image, or an abstract image the test generates |

**Courses & badges copy (v0.7).** Reviewed on the build; "as built" means approved unchanged.

| Where | Copy |
|---|---|
| Page title and nav | `h1` and `<title>` "Courses & badges" (as built; the content plan's name); nav label "Courses" (as built: short enough for the sidebar and the More sheet) |
| Description | "27 courses from OpenAI and Anthropic, each placed in the roadmap phase where it fits. Tracked separately from roadmap progress." (as built; it mirrors Reading's description) |
| Facts | "Done" "3 of 27"; "Badges earned" "1 of 21"; "Stated length" "44–49 h (19 of 27 courses)". Build: "Courses 27" (dropped, it repeats "of 27") and "Stated length 44–49 h · 19 courses", which read as if there were only 19 courses; the brackets say it is the total for the 19 that state a length |
| Card 1 | `h2` "OpenAI developer tracks" (as built); sub "Self-paced tracks on OpenAI's developer site, each with a length and a level. No badge." (build: "… Each gives a length and a level; no badge is mentioned.") |
| Card 2 | `h2` "OpenAI Academy" (build: "OpenAI Academy · Build with AI"; "Build with AI" isn't in the content plan or its sources, so the title names the provider only, like the other two); sub "Every course ends with an assessment and an official badge from Accredible, a service that issues digital certificates. No lengths are given." (defines Accredible, and explains why these rows have no meta line) |
| Card 3 | `h2` "Anthropic Claude Academy" (as built); sub "Each course gives its lessons and length. Most award a completion badge, marked Badge." (build: "A completion badge where the course page lists one.", which didn't say which ones; the chip does) |
| Top-pick line (why line) | "**Top pick for the FDE role:** {reason}." Reasons, rewritten from the content plan's notes so they read as one sentence each and define "evals" once: cr4 "scoping a customer's problem into a solution plan." / cr5 and cr26 "evals, the tests that show whether an AI app's answers are good enough." / cr25 "it pairs with the AWS certifications." / cr27 "rolling Claude out at a customer." (build: "For the FDE role: evals." and "For the FDE role: lines up with the AWS certifications.") |
| Chips | "Badge" (tag); phases "Phase 1 · Foundations", "Phase 2 · RAG", "Phase 4 · Agents", "Phase 5 · Project 2", "Phase 6 · AWS", "Phase 7 · Evaluation", "Phase 8 · Portfolio" (neutral). No "Top pick" chip |
| Page filter | Hidden label "Filter by badge, top pick or phase" (build: "Badge, pick or phase": "pick" alone is unclear when read out); options "All courses", "With a badge", "Top picks" (as built), then the short phase labels |
| Small print | "Lengths and badges from the providers' pages, checked 26 Nov 2026. Providers change their catalogues, so check before relying on them." (as built); "Sources:" then "OpenAI developer tracks", "OpenAI Academy", "Anthropic Claude Academy" (build: "OpenAI Academy courses", "Claude Academy courses"; the labels now match the card titles) |
| Home tile | Value "2/27"; label "Courses done · 2 badges earned" / "Courses done · 1 badge earned" / "Courses done · 0 badges earned" (as built). Screen readers: "2 of 27 done, Courses done · 2 badges earned" (as for the other tiles) |

**Who can sign in: one constant (v0.4).** Keep everything that depends on the sign-up mode in one place (for example `lib/login.ts`, `ACCESS_COPY[mode]`), with the mode set in one line. Only the access line changes on the default screen; the not-allowed error changes with it. The rest of the page (heading, tagline, button, fine print) is the same in every mode.

| Mode | Access line (under the sub line) | Not-allowed error (`?error=not_owner` or its later equivalent) |
|---|---|---|
| `owner-only` (now) | "Private for now: only the owner's GitHub account can sign in." | "This GitHub account can't sign in. FDE Journey is private to its owner for now." |
| `capped` (M4b, v0.5) | "New here? Continue with GitHub to start your own tracker. Places are limited; if they're full you'll join the waitlist." | Not needed: past the cap, people join the waitlist instead (`null`, as for `open`) |
| `open` (later) | "New here? Continue with GitHub to start your own tracker." | Not needed |

Checked against `web/lib/login.ts` on 2026-11-26: `AccessMode` is `"owner-only" | "invite-only" | "open"`, and `ACCESS_COPY` has those three entries. For M4b:
- Add `"capped"` to `AccessMode` and this entry to `ACCESS_COPY`: `capped: { access: "New here? Continue with GitHub to start your own tracker. Places are limited; if they're full you'll join the waitlist.", notAllowed: null }`. Its first sentence is the `open` line word for word, so the two modes read as one family.
- Remove `"invite-only"`: the owner replaced invites with the cap and waitlist on 2026-11-26 (`M4-DESIGN.md`), so its copy would never show. `M4-DESIGN.md` section 2 names the modes `owner-only`, `capped` and `open`.
- `loginMessage` already falls back to "Sign-in didn't finish. Try again." when `notAllowed` is `null`; keep that.
- The suspended error and the two new info messages are not mode copy; they are notices like `signed-out` (`LoginNotice` gains `"suspended"`, `"deleted"` and `"left-waitlist"`). Copy below.
- The comment on `ACCESS_MODE` says the real gate is `ownerGate` and `isOwnerUser`; in `capped` mode the gate is the cap and the status, so update that comment with the code.

**M4b copy (v0.5).** `{name}` is the GitHub display name (or the username when there is none); `@{username}` the GitHub username. Examples use made-up people only.

| Where | Copy |
|---|---|
| Login: suspended (error banner, `?error=suspended`) | "This account is suspended, so it can't sign in. If you think this is a mistake, open an issue on GitHub." Link: "Open an issue" (new tab) |
| Login: after deleting the account (info, `?status=deleted`) | "Your account and data are deleted." |
| Login: after leaving the waitlist (info, `?status=left-waitlist`) | "You've left the waitlist and your account is deleted." |
| Login: privacy link (under the fine print) | "Privacy: what's stored and who sees it" |
| Waitlist: heading | "You're on the waitlist" |
| Waitlist: place | Kicker "Your place in line"; number "12"; line "11 people are ahead of you." / "1 person is ahead of you." / "You're next." |
| Waitlist: explanation | "FDE Journey has a limited number of places, and they're all taken right now. You'll get in when a place opens or the owner adds more places, in the order people joined." |
| Waitlist: check back | "We don't send email, so check back here. Sign in any time to see your place; once you're in, you'll go straight to your tracker." |
| Waitlist: joined | "Joined the waitlist on 30 Nov 2026." |
| Waitlist: actions | "Sign out" / "Leave the waitlist" |
| Waitlist: leave dialog | Title "Leave the waitlist?"; body "This deletes your account and your place in line. If you sign in again later, you'll join at the back."; buttons "Cancel" / "Leave the waitlist"; loading "Leaving…" |
| Waitlist: leave failed (dialog) | "Couldn't leave the waitlist. Check your connection and try again." |
| Navigation | "Settings" / "Admin"; bar and sheet as today |
| First-visit banner, when any section is off | Today's text, then: "Want Scaler, Projects or Career too? Turn them on in Settings." ("Settings" is the link; list only the sections that are off, joined with commas and "or") |
| Hidden section opened directly (info banner, v0.6) | "You've hidden Career from your menu." Link: "Turn it back on in Settings" (to `/settings`). Only for sections the person switched off; a locked Scaler section is not-found |
| Settings: header | `h1` "Settings"; description "Choose your sections, download your data or delete your account." |
| Settings: Sections card | `h2` "Sections"; sub "Choose what shows in your menu and on Home. Hidden sections keep their progress, so you can turn them back on any time." |
| Settings: section descriptions | Roadmap "Phases, tasks and learning resources." + "Always on"; Reading "Research papers and books."; Scaler course "Classes for the Scaler course. Turn on if you're taking it."; Certifications "Certifications in a suggested order."; Projects "Three portfolio projects, step by step."; Career "Career milestones and your Weekly notes." |
| Settings: switch failed | "Couldn't save this change." + "Try again" |
| Settings: Scaler row while locked (v0.6) | Right column "Locked" (lock icon); line under the description "Enter your access code below to unlock it." The build's "Needs the Scaler access code first (below)." is rewritten: it starts with what to do, and drops the bracket |
| Settings: Unlock Scaler course card (v0.6) | `h2` "Unlock Scaler course" (build: "Scaler course"); text "The Scaler course section is for people taking the Scaler course. If you were given an access code, enter it here. You only need to do it once." (build: "The Scaler section is for people taking the Scaler course. Enter the access code you were given to unlock it. You only need to do this once."; rewritten so it doesn't assume everyone reading has a code); label "Access code"; button "Unlock", loading "Checking…" (approved) |
| Settings: Scaler code messages (v0.6, approved as built) | Empty "Enter the access code." / wrong "That code isn't right. 4 tries left this hour." ("1 try left this hour.") / last wrong "That code isn't right. Try again in an hour." / limited "Too many tries. Try again in an hour." / no code set "There's no Scaler access code yet. Ask the owner for one." / connection "Couldn't check the code. Check your connection and try again." / success banner "Scaler course is unlocked and on." |
| Settings: Claude export keys card (v0.6) | `h2` "Claude export keys" (approved). Text, rewritten: "An export key lets Claude (the AI assistant) read your progress: ticks, notes, links and section choices. It can't change anything. Give Claude the key and the export address below. Each key is shown once, so copy it when you create it, and revoke any key you no longer use." (build: "A key lets a Claude session read your progress (ticks, notes, links and section choices) from the export address, and nothing else. Each key is shown once, so copy it when you create it. Revoke a key you no longer use."; it named an address it never showed, and "Claude session" is undefined for people who don't use Claude Code). Address: label "Export address", button "Copy" ("Copied"; failed "Couldn't copy. The address is selected: copy it yourself.") |
| Settings: export key rows (v0.6) | "Key created 26 Nov 2026, 14:05 IST" (build drops the time; add it); "Last used today" / "Last used yesterday" / "Last used on 3 Dec" / "Never used" (approved); button "Revoke" (accessible "Revoke the key created 26 Nov 2026, 14:05 IST"); none "No keys yet."; button "Create a key", loading "Creating…"; limit "You already have 5 keys. Revoke one first." (approved) |
| Settings: new export key (v0.6, approved as built) | Label "Your new key"; line "Copy it now and keep it somewhere safe. It won't be shown again."; buttons "Copy" ("Copied") and "Done"; status "Copied to the clipboard." / "Couldn't copy. The key is selected: copy it yourself." |
| Settings: revoke a key (v0.6) | Title "Revoke this key?"; body "The key created 26 Nov 2026, 14:05 IST stops working at once, so any Claude session using it can't read your data any more. This can't be undone." (approved, with the time added); buttons "Cancel" / "Revoke"; loading "Revoking…"; result "Key revoked. Anything using it can't read your data any more." (approved) |
| Settings: Your data card | `h2` "Your data"; text "Download everything you've saved: your GitHub profile details, ticks, notes, links, Weekly notes, section choices and activity history. It comes as a JSON file (a plain text format other apps can read)."; button "Download my data", loading "Preparing…"; failed "Couldn't prepare your download. Try again."; line "Read what's stored and who can see it on the privacy page." |
| Settings: Delete card | `h2` "Delete account"; text "Deletes your account and everything in it: progress, notes, links, Weekly notes, settings and sign-ins. It can't be undone, so download your data first if you want a copy."; button "Delete my account". Owner: "The owner's account can't be deleted here." |
| Settings: delete dialog | Title "Delete your account?"; body "This deletes your progress, notes, links, Weekly notes, settings and sign-ins at once. It can't be undone."; label "To confirm, type your GitHub username: sam-example"; mismatch "That doesn't match your username. Type sam-example."; empty "Type your GitHub username to confirm."; buttons "Cancel" / "Delete my account"; loading "Deleting…"; failed "Couldn't delete your account. Nothing was deleted. Try again." |
| Admin: header (every tab) | Eyebrow "Admin"; `h1` the tab name; description "Counts and dates only. Notes, links, Weekly notes and email addresses are never shown here." |
| Admin: tabs | "Overview", "Users", "Waitlist", "Sign-up", "Admins", "Audit log" |
| Admin Overview: tiles | "42/100" "places taken · 58 free"; "7" "people waiting"; "18" "used the app in the last 7 days"; "35" "used the app in the last 30 days"; "214" "items marked done since Monday, all users" |
| Admin Overview: sign-ups card | `h2` "Sign-ups per week"; sub "Last 8 weeks. Weeks start on Monday (IST). Includes people who joined the waitlist."; columns "Week of", "Sign-ups"; empty "No sign-ups yet." |
| Admin Users | Search placeholder "Search people…"; filter "All people", "Active", "Waitlisted", "Suspended", "Admins"; columns "Person", "Status", "Signed up", "Last active", "Done", "Actions"; last active "Today" / "Yesterday" / "3 Dec" / "Never"; done line "Roadmap 12 · Resources 30 · Reading 3", or "Nothing yet"; "Show 50 more"; no matches "Nobody matches this search or filter." + "Clear search and filter" |
| Admin Users: suspend | Button "Suspend" (accessible "Suspend Sam Example"); dialog title "Suspend Sam Example?"; body "They're signed out at once and can't sign in until someone reactivates them. Their progress and notes are kept."; buttons "Cancel" / "Suspend"; loading "Suspending…"; result "Sam Example is suspended." |
| Admin Users: reactivate | Button "Reactivate"; loading "Reactivating…"; result "Sam Example can sign in again." When every place is taken (v0.6, approved as built): "Sam Example is reactivated. All places are taken, so they joined the waitlist." |
| Admin Waitlist | Line "58 places free · 7 waiting"; field "How many"; button "Let them in"; dialog "Let in the next 5 people?" / "They get a place in the order they joined. They'll see it the next time they sign in." / "Cancel", "Let them in"; loading "Letting in…"; result "5 people were let in." (one person: "Sam Example was let in.") |
| Admin Waitlist: full | "All 100 places are taken." + "Raise the cap in Sign-up to let more people in." (without the permission: "Ask an admin who can change the cap.") |
| Admin Waitlist: field error | "Enter a number from 1 to 7." |
| Admin Waitlist: queue | Heading "The queue" (v0.6, approved as built); columns "Place", "Person", "Joined", "Actions"; card place "Place 1"; buttons "Let in" / "Remove"; empty "Nobody is waiting." |
| Admin Waitlist: remove | Title "Remove Sam Example from the waitlist?"; body "This deletes their account and their place. If they sign in again, they join at the back."; buttons "Cancel" / "Remove"; loading "Removing…"; result "Sam Example was removed from the waitlist." |
| Admin Sign-up | `h2` "User cap"; facts "Cap", "Places taken", "Free", "Waiting" (v0.7: "Cap" added, first); field "User cap"; hint "How many people can have a place. The owner isn't counted. 0 stops new places; everyone new joins the waitlist."; button "Save cap"; errors "Type the number without a leading 0." (v0.7) / "Enter a whole number from 0 to 1,000."; unchanged (v0.7, `muted`, not an error) "The cap is already 100." |
| Admin Sign-up: raise dialog | Title "Raise the cap to 120?"; body "This lets in the next 7 people from the waitlist, in the order they joined."; buttons "Cancel" / "Raise cap" |
| Admin Sign-up: lower dialog | Title "Lower the cap to 30?"; body "42 people already have places. Nobody loses theirs, but new sign-ups join the waitlist until fewer than 30 people have places."; buttons "Cancel" / "Lower cap" |
| Admin Sign-up: results | v0.7: "Cap changed from 100 to 120 places." / "Cap changed from 100 to 120 places. 7 people were let in." / "Cap changed from 0 to 1 place." / "… 1 person was let in." (was "Cap saved: 120 places.") |
| Admin Sign-up: Scaler access code card (v0.6, approved as built) | `h2` "Scaler access code"; status "A code is set (last changed 26 Nov 2026). Scaler learners enter it in their Settings to unlock the Scaler section." / "No code is set yet, so nobody else can unlock the Scaler section."; label "New access code" ("Access code" when none is set); hint "6 to 64 letters, numbers or symbols; capitals don't matter. It's stored scrambled and can't be shown again. Changing it doesn't lock out anyone who already unlocked Scaler."; button "Save code", loading "Saving…"; error "Use 6 to 64 letters, numbers or symbols."; result "Scaler access code saved. People who already unlocked Scaler keep it." |
| Admin Admins: add | `h2` "Add an admin"; field "GitHub username"; button "Find"; not found "No active user has that username."; not active "Only people with a place can be admins."; button "Make admin"; dialog "Make Sam Example an admin?" / "They can: See users, Manage the waitlist." / "Cancel", "Make admin"; loading "Saving…"; result "Sam Example is now an admin." (v0.6, approved as built) |
| Admin Admins: other Find answers (v0.6) | Empty "Type a GitHub username." (approved) / the owner "That's the owner, who already has every permission." (build: "…who has every permission already."; word order only) / already an admin "Sam Example is already an admin. Change their permissions below." (approved) / waitlisted "Sam Example is on the waitlist. Only people with a place can be admins." / suspended "Sam Example is suspended. Only people with a place can be admins." (build: "Only people with a place can be admins." alone; naming the person and their status confirms the admin typed the right username) |
| Admin Admins: shared username (v0.6) | Line "2 people have this username. One of them changed it on GitHub and hasn't signed in since. The one who was active most recently probably holds it now." (build: "Several people have this username. Choose one:"); row "Signed up 26 Aug 2026 · Last active 3 Dec"; button "Choose" (accessible "Choose Pat Example, signed up 26 Aug 2026"); after choosing, ghost button "Choose someone else" |
| Admin Admins: owner card | "Has every permission. This can't be changed here." |
| Admin Admins: permissions | "See the overview": "Numbers of places, sign-ups and activity." / "See users": "Names, usernames, status, dates and done counts." / "Suspend and reactivate users": "Stop someone signing in, or let them back." / "Manage the waitlist": "Let people in or remove them from the queue." / "Change the user cap": "Set how many people can have a place." (v0.6: the same permission also sets the Scaler access code; change the label to "Change the user cap and Scaler code" and the description to "Set how many people can have a place, and the Scaler access code.") / "See the audit log": "Every admin action and account change, newest first." (v0.6; was "Every admin action, newest first.") / "Manage admins": "Make people admins and change their permissions." Implied: "Needed to suspend and reactivate users." |
| Admin Admins: change dialog | Title "Change Sam Example's permissions?"; body "Give: See users, Manage the waitlist. Take away: See the audit log." (omit an empty part); buttons "Cancel" / "Save changes"; result "Sam Example's permissions are saved." |
| Admin Admins: remove | Button "Remove as admin"; title "Remove Sam Example as an admin?"; body "They lose every admin permission at once. Their own tracker isn't affected."; buttons "Cancel" / "Remove as admin"; result "Sam Example is no longer an admin."; empty "No other admins yet." |
| Admin Audit log | Filter "All actions", "Let in", "Removed from waitlist", "Suspended", "Reactivated", "Cap changed", "Permissions changed", "Scaler access code", "Accounts deleted" (v0.6: last two added); columns "When", "Who", "What"; caption "Actions, newest first."; empty "Nothing recorded yet." (v0.6; was "No admin actions yet.") |
| Admin Audit log: sentences | "Let in @sam-example." / "Let in 5 people from the waitlist." / "Removed @sam-example from the waitlist." / "Suspended @sam-example." / "Reactivated @sam-example." / "Changed the cap from 100 to 120 and let in 7 people." / "Changed the cap from 120 to 100." / "Made @alex-example an admin: See users, Manage the waitlist." / "Changed @alex-example's permissions. Gave: See the audit log. Took away: Manage the waitlist." / "Removed @alex-example as an admin." A deleted person: "a deleted account" in place of "@username" |
| Admin Audit log: sentences added in the build (v0.6) | Reactivated when full: "Reactivated @sid-example. No place was free, so they joined the waitlist." (approved) / code set: "Set a new Scaler access code." (approved) / wrong code: "Entered a wrong Scaler access code (try 2 of 5 this hour)." (build: "(try 2 this hour)"; "of 5" says how close the limit is) / account deleted, with a place: "Deleted their account." (build: "Deleted their own account."; Who already says "a deleted account", so "own" adds nothing) / account deleted from the waitlist: "Left the waitlist, which deleted their account." (approved) / first cap: "Set the cap to 100." (approved) / unknown kind: "Made a change." (approved fallback) |
| Admin: generic failures | In a Dialog or a row: "That didn't work, and nothing was changed. Try again." Permission gone: "You no longer have permission to do this." |
| Privacy page | See "Privacy page text" below |

**Privacy page text (v0.6).** Plain words; "the owner" is the one person who runs FDE Journey. v0.6 replaces the v0.5 draft and the built page's text. Changes from the build, and why:
- Restore history: "removed automatically after a while" becomes 6 hours (Neon `history_retention_seconds` = 21,600 on the production project, read by the lead on 2026-11-26).
- Vercel logs: no number (Hobby's retention isn't published as one); the page says they're kept for a short time on Vercel's schedule, and promises only what the app controls: it never writes notes, links, email addresses or keys to its logs. It no longer says "logs of visits" or implies the logs hold nothing personal: request logs can hold page addresses, which include search text.
- Owner access: says plainly that the owner can reach everything, including notes, and when they would. Approved by the owner as written on 2026-11-26: it is a promise about their own behaviour, so change it only with their approval.
- Added what M4b stores that the v0.5 draft didn't know about: export keys, Scaler access, admin actions about you, and wrong Scaler codes (visible to admins in the audit log).
- "Download" now lists what the file holds; the build said "everything listed above", but the file has no sign-ins, keys or audit entries.
- Items in braces are still to be filled at launch.

> **Privacy**
> Last updated {the date this text goes live}.
>
> **In short**
> - FDE Journey keeps your GitHub profile and the progress you record, so you can track your journey.
> - Nothing is sold, shared or used for ads.
> - Admins see counts and dates, never your notes, links, Weekly notes or email address.
> - You can download or delete your data at any time in Settings.
>
> **What's stored**
> - From GitHub, when you sign in: your name, profile picture, username, email address, and your GitHub account number (it stays the same if you rename your account).
> - What you add: what you mark done and when, your notes and links, your Weekly notes, and which sections you show.
> - Activity: a record of each change you make (which item, what kind of change, and when). It never includes the text of a note.
> - Sign-ins: when each sign-in started and ends, and the browser and internet (IP) address used. These keep you signed in and help stop misuse. They're deleted when the sign-in ends or your account is deleted.
> - Claude export keys, if you create any: a scrambled form of each key (the key itself can't be read back from it), when it was created and when it was last used.
> - Scaler course: whether and when you unlocked it. If you type a wrong access code, that a wrong try happened and when, never what you typed.
> - If you're on the waitlist: when you joined.
> - Admin actions about you: if an admin lets you in, suspends or reactivates you, or makes you an admin, that action and its date are recorded.
>
> **Where it's stored**
> - The database is hosted by Neon, in Singapore.
> - The app runs on Vercel, in Singapore. Vercel keeps server logs of requests to the app for a short time and deletes them on its own schedule. The app never writes your notes, links, email address or keys to these logs.
> - Everything travels over encrypted connections (HTTPS).
>
> **Who can see it**
> - You.
> - Admins, on the admin pages: your name, profile picture and username; whether your account is active, waitlisted or suspended; when you signed up and were last active; how many items you've marked done in each section; and, in the audit log, the admin actions about you and any wrong Scaler access codes you tried. Never your notes, links, Weekly notes or email address.
> - Anyone you give one of your Claude export keys to (for example a Claude session): your ticks, notes, links and section choices, until you revoke the key in Settings.
> - The owner runs FDE Journey and its database, so they can reach everything stored, including notes. They only do that to keep the app running or to fix a problem, and they don't read your notes, links or Weekly notes. (Approved by the owner, 2026-11-26.)
>
> **What isn't done with it**
> - Nothing is sold or shared with anyone.
> - No ads, and no tracking cookies. The only cookie keeps you signed in.
> - No email is sent. Your email address is stored because GitHub shares it, and it isn't used for anything else.
>
> **Download or delete your data**
> - Download: Settings → "Download my data" gives you your GitHub profile details, ticks, notes, links, Weekly notes, section choices and activity history, as a JSON file (a plain text format other apps can read).
> - Delete: Settings → "Delete my account" removes your account, progress, notes, activity, settings, export keys and sign-ins at once. The audit log keeps its entries, but they show "a deleted account" instead of your name.
> - Neon keeps a restore history of the database for 6 hours, so for up to 6 hours after you delete your account it could still be brought back from there. After that, it's gone.
> - On the waitlist: "Leave the waitlist" deletes your account too.
>
> **Questions**
> Open an issue on the project's GitHub page. Issues are public, so don't include your email address or anything private. You don't need to ask before downloading or deleting your data; you can do both yourself in Settings.
> [Open an issue on GitHub ↗]
>
> [Back to FDE Journey]

## 9. Brand (v0.4)

**The mark.** A path that climbs through milestones and ends in a spark, drawn as a lowercase "j" for Journey: the round start node is where the path begins, the bowl is the work, the stem is the climb, and the spark at the top is the goal (it also reads as the dot of the "j" at 16 px). Built on a 32-unit grid: the J is a 4-unit stroke with round caps (`M8 21.5a7 7 0 0 0 14 0V15`), the start node a circle of radius 4 at (8, 19.5), and the spark a four-point star centred at (22, 5.5) with 5-unit arms. The gap between the spark and the stem (2.5 units) keeps them apart at 16 px. The stem sits on whole pixels at 16 and 32 px.

**Files** (each has a `viewBox`, a `<title>`, and no editor metadata)
| File | What | Size |
|---|---|---|
| `web/public/brand/logo-mark.svg` | Colour mark: `#0b7a68` in light, `#3fcfb3` in dark (through `prefers-color-scheme` inside the SVG, which browsers apply to SVGs shown with `<img>`). For places outside the app's CSS: README, social preview, docs | 442 bytes |
| `web/public/brand/logo-mark-mono.svg` | One colour, `currentColor`. The source for the inline React component | 331 bytes |
| `web/app/icon.svg` | App icon and favicon: a `#0b7a68` tile (radius 7 of 32) with the mark in white at 80% size. Next.js turns `app/icon.svg` into `<link rel="icon" type="image/svg+xml" sizes="any">` (checked in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`) | 420 bytes |

**In the app,** use the mark as an inline SVG component (paths from `logo-mark-mono.svg`, `fill`/`stroke="currentColor"`, `aria-hidden`), coloured with `text-accent` (or `text-brand-accent` on the panel), so the colour tokens and dark mode drive it. Don't load the colour file with `<img>` inside the app.

**Wordmark.** "FDE Journey" in Space Grotesk 600 (`wordmark`), tracking -0.01em, one colour (`ink`, or `brand-ink` on the panel). Never all caps, never in two colours, never set in another font.

**Lockup.** The mark left of the wordmark, centred vertically, gap 10 px. The mark is about 1.5 times the wordmark size: 24/16, 28/18, 32/20.

**Minimum size and clear space.** The bare mark down to 20 px; below that (favicons) use the tile, which is drawn for 16 px. The lockup down to a 14 px wordmark. Keep clear space of a quarter of the mark's height on every side (8 px around a 32 px mark).

**Don't:** recolour it outside the tokens, add shadows or gradients, rotate or stretch it, or put the teal mark on a teal background (use the mono mark in `accent-ink` there).

**Favicon and app icon.**
- `app/icon.svg` is the favicon in current browsers and the app icon tile. It is checked at 16 and 32 px on light and dark tab strips.
- `app/favicon.ico` is still the Next.js default "N" from the scaffold. Replace it with the matching ICO (16, 32 and 48 px, rendered from `icon.svg`) for browsers that only read `.ico`. Otherwise the two disagree.
- Add `app/apple-icon.png`, 180 by 180, full bleed with no rounded corners and no transparency (iOS rounds it), for "Add to Home Screen".
- The lead has candidate files for both and decides whether to add them.
- The installable app (PWA manifest icons) comes later, with that feature.

## 10. Insights (M5a, v0.8)

Route `/insights`, `<title>` "Insights · FDE Journey". Behind the same gate as every app page; usual app frame. Scope and counting rules are `M5-DESIGN.md` (weeks start Monday in IST; a completion is an item done **now**, in the week of its `done_at`; activity comes from `progress_event`, and from `done_at` before 26 Nov 2026; hidden or locked sections are left out everywhere). This section decides how it looks and reads.

**Kinds.** One list, used in the same order everywhere (stack order bottom to top, legend order, "By kind" order). A kind shows only while its section is on; Scaler only once unlocked.

| # | Kind | Ids | Label (legend, table, summaries) | Shown when |
|---|---|---|---|---|
| 1 | Roadmap tasks | `l` | "Roadmap tasks" | Always |
| 2 | Learning resources | `r` | "Learning resources" | Always |
| 3 | Reading | `pp`, `bk` | "Reading" | Reading on |
| 4 | Scaler classes | `s` | "Scaler classes" | Scaler on (so unlocked) |
| 5 | Certification prep | `c` | "Certification prep" | Certifications on |
| 6 | Courses | `cr` | "Courses" | Always |
| 7 | Projects and career | `p`, `k` | "Projects and career"; "Projects" or "Career" when only that one is on | Projects or Career on |

### 10.1 Page layout

Order is the same at every width (and in the DOM):

1. **PageHeader**: `h1` "Insights"; description "How your learning is going, week by week. Weeks run Monday to Sunday in India Standard Time (IST)."; facts **"This week" "Mon 23 Nov – Sun 29 Nov"** (one fact; `formatWeekdayDate` both ends). The fact depends on today, so it streams like Home's facts (Suspense, "–" until ready). The header renders at once.
2. **Banners** (offline etc., as on every page).
3. **At a glance**: three plain tiles, then the streak definition line and, if any section is hidden, the hidden-sections line (10.2 A).
4. **Done per week** card (10.2 B).
5. **Active days** card (10.2 C).
6. **Current phase** card (10.2 D) and **This month** card (10.2 E): one row from `xl`.
7. **Certifications** card (10.2 F), only while Certifications is on.

Everything below the header waits for one data load (`M5-DESIGN.md`, Speed), so it sits in **one** Suspense boundary with one skeleton (10.6). Gaps: 12 px between cards and tiles, as elsewhere. Use `MidnightRefresh` (already in the app layout) so "this week" and "today" move on at midnight IST.

| Width | Navigation | Column | At a glance | Cards |
|---|---|---|---|---|
| 320 | Bottom bar | 288 px (card inside 254 px) | 2 columns: "This week" across both, then the two streak tiles | One column. Bar chart columns 21 px, bars 13 px. Heatmap cells 7 px (it shrinks; all 26 weeks stay) |
| 390 | Bottom bar | 358 px (inside 324 px) | As 320 | One column. Bars 16 px; heatmap cells 9.4 px |
| 768 | Bottom bar | 720 px (inside 686 px) | 3 in a row | One column. Bars 34 px; chart plot 200 px tall from here; heatmap at its 520 px cap (cells 15.6 px), left-aligned |
| 1024 | Sidebar | 712 px (inside 678 px) | 3 in a row | As 768 |
| 1280 | Sidebar | 960 px (inside 926 px) | 3 in a row | Done per week and Active days full width (bars 46 px). **Current phase and This month side by side** (`xl:grid-cols-2`, 474 px each, equal height). Certifications full width with its rows in **two columns** (`xl:grid-cols-2 xl:gap-x-6`) |
| 1440, 1920 | Sidebar | 960 px, centred (as 3.4) | As 1280 | As 1280. No right-hand column |

**Why no second page column.** Every page is one 960 px column (3.4); the two charts read best at full width (a 12-bar chart in a 474 px half gets 22 px bars and cramped totals); and two independent stacks would put the cards in a different order on screen than in the DOM. The pairs above fill the only rows that would otherwise leave a half-empty line. Wrapper for the pair: `grid gap-3 xl:grid-cols-2`; when either card is absent, the other spans the row (it can't be: both always render, with their empty text when needed).

```
390 px                                  1280 px (content 960)
+-------------------------------+       +------------------------------------------------+
| Insights               (h1)   |       | Insights                                (h1)   |
| How your learning is going... |       | How your learning is going, week by week. ...  |
| THIS WEEK Mon 23 Nov – Sun 29 |       | THIS WEEK  Mon 23 Nov – Sun 29 Nov             |
| [ 5  done this week · 7 last ]|       | [5 done this week] [3 current streak] [6 long] |
| [ 3 streak ]  [ 6 longest ]   |       | A streak counts the weeks in a row ...         |
| A streak counts the weeks ... |       | +--------------------------------------------+ |
| +---------------------------+ |       | | Done per week                              | |
| | Done per week             | |       | |  ▁ ▃ ▂ ▅ ▇ ▆ ▃ ▅ ▆ ▄ ▇ █ (stacked, totals) | |
| | stacked bars, 12 weeks    | |       | |  key · Show as table                       | |
| | key · Show as table       | |       | +--------------------------------------------+ |
| +---------------------------+ |       | | Active days   LAST 30 DAYS 12 ...          | |
| | Active days  facts        | |       | | [26 x 7 calendar, 520 px]                  | |
| | [26 x 7 calendar]         | |       | +--------------------------------------------+ |
| +---------------------------+ |       | +----------------------+ +-------------------+ |
| | Current phase             | |       | | Current phase        | | This month        | |
| +---------------------------+ |       | +----------------------+ +-------------------+ |
| | This month                | |       | | Certifications: rows in two columns        | |
| +---------------------------+ |       | +--------------------------------------------+ |
| | Certifications            | |       +------------------------------------------------+
+-------------------------------+
```

### 10.2 Blocks: content, empty state, skeleton

Cards use Card and CardHead (section 4): `h2` in `title`, sub line `small` `muted`, body padding `px-4 pb-4`. Numbers in `num` or `num-lg`.

**A. At a glance** (`<section>` with a visually hidden `h2` "This week at a glance").
- Three **plain StatTiles** (StatTile, plain variant, v0.5: a `<div>`, no bar, no hover). The admin Overview's local `Tile` already draws exactly this; move it to `components/` and reuse it. Grid: `grid grid-cols-2 gap-3 md:grid-cols-3`, first tile `col-span-2 md:col-span-1` (the odd-count rule of 5, Home).
  1. **This week**: value "5"; label "done this week · 7 last week". Hidden full reading "5 items done this week, 7 last week".
  2. **Current streak**: value "3"; label "weeks in your current streak" ("week" for 1). Under it, a second `small` `muted` line only when it applies: this week has nothing yet but the streak is alive: "Mark something done this week to keep it going."; streak 0: "Mark something done this week to start one."
  3. **Longest streak**: value "6"; label "weeks in your longest streak" ("week" for 1).
- Under the tiles (`small`, `muted`, `max-w-[34em]`), the **streak definition**, the only place it is defined: "A streak counts the weeks in a row, Monday to Sunday, in which you marked at least one item done. This week joins your streak as soon as you do."
- Then, only when the person has switched sections off (never for a locked Scaler, which they never had): "Hidden sections aren't counted here: Scaler course and Projects." plus the link "Show them in Settings" (`/settings`). List the nav labels, joined with commas and "and".
- Empty: zeros are fine here (they are numbers, not a chart); the hint lines say what to do.
- Skeleton: three tiles in the same grid, each a 28 by 48 px block and a 14 px line at 75%; then one 14 px line at 80% for the definition.

**B. Done per week** (card).
- Head: `h2` "Done per week"; sub "Last 12 weeks. An item counts in the week you marked it done; if you untick it, it leaves the chart."
- Body: the bar chart (10.4), its key, the summary sentence and "Show as table" (10.5).
- Empty (no completions of any shown kind in the 12 weeks): no chart, no key, no table. A paragraph (`small`, `muted`): "Nothing marked done in the last 12 weeks. Tick your first item to start your weekly chart." and a link "Go to the Roadmap" (`accent`, underlined, `/roadmap`).
- Skeleton: head blocks (20 px at 33%, 14 px at 66%), then a 160 px (200 px from `md`) area holding 12 bottom-aligned `sunk` bars, 60% of their column wide, at fixed heights (35, 55, 45, 70, 60, 85, 50, 65, 90, 60, 75, 40 % of the area), then a 14 px line at 50% for the key.

**C. Active days** (card).
- Head: `h2` "Active days"; sub "Last 26 weeks. A day is active when you tick or untick an item, or save a note or link."
- Body, in order:
  1. Facts (the existing Facts component): "Last 30 days" "12 active days"; "Last 26 weeks" "48 active days" ("1 active day" for one).
  2. The calendar heatmap (10.4), 12 px below.
  3. Its key (10.4).
  4. While the 26 weeks reach back before 26 Nov 2026 (until the week of Mon 24 May 2027): the estimate line (`small`, `muted`, `max-w-[34em]`): "Days before 26 Nov 2026 are estimated from when items were marked done, so they may show less than you did."
  5. Summary sentence and "Show as table" (10.5).
- Empty (no activity in the 26 weeks): no facts, chart, key or table. Paragraph: "No activity in the last 26 weeks yet. Each day you tick an item or save a note fills in a square here."
- Skeleton: head blocks; a 14 px line at 60% (facts); one block `aspect-[26/7] w-full max-w-[488px]` with a 32 px left margin (the calendar); a 14 px line at 40% (key).

**D. Current phase** (card).
- Head: `h2` "Current phase"; sub "Phase 2 · RAG and retrieval" (`small`); chip-and-count group: StatusChip from the phase model ("This phase", `now`) and Count "3/9" ("3 of 9 done").
- Body: ProgressBar (full width), then Facts, 12 px below:
  - "Ends": "Tue 15 Dec · 6 days left" / "Tue 15 Dec · last day" (today is the end date).
  - "Projected finish" (only while tasks are left): "Sat 12 Dec · 3 days before it ends" / "Tue 15 Dec · on its last day" / "Fri 18 Dec · 3 days after it ends" ("1 day"); or, with fewer than 2 recent completions, "Not enough recent activity".
  - Under the facts (`small`, `muted`): "At your pace over the last 4 weeks: 6 roadmap tasks done." or, without a projection, "Mark at least 2 roadmap tasks done within 4 weeks to see a projected finish."
  - All tasks done: no "Projected finish" and no pace line; instead "All tasks in this phase are done." (Home's existing words).
- Projection (for the back end; pure function in `lib/insights.ts`): `pace` = roadmap tasks (`l`) done now whose `done_at` falls in the last 28 days including today (IST). Shown only when `pace >= 2`. Days needed = `ceil(remaining × 28 / pace)`; projected date = today + days needed. See 10.9 for the "roadmap tasks only" choice.
- No phase includes today: before the first phase, "The roadmap starts on 24 Nov 2026."; after the last, "The roadmap's last phase ended on 15 Feb 2027." (`small`, `muted`), each followed by the link "Go to the Roadmap". No chip, count or bar.
- Skeleton: head blocks plus a 6 px bar and two 14 px lines.

**E. This month** (card).
- Head: `h2` "This month"; sub "Since 1 Nov" (the 1st of the current IST month).
- Body: a `<dl>` in two equal columns at every width (`grid grid-cols-2 gap-3`). Each pair shows the number first (`num-lg`, `ink`) and the label under it (`small`, `muted`); keep `dt` before `dd` in the DOM and order them visually with `flex flex-col-reverse`.
  - "4" / "items with a note or link saved" (each item counts once a month, however many times it was saved; the back end counts distinct items with a note-saved event since the 1st).
  - "7" / "learning resources finished" (`r` items done now with `done_at` this month).
- In November 2026 only, a line under them (`small`, `muted`): "Notes are counted from 26 Nov 2026, when the app started recording them."
- Both zero: a line under them: "Notes you save and learning resources you finish this month will show here."
- Skeleton: head blocks and two 28 by 32 px blocks with 14 px lines under them.

**F. Certifications** (card; only while Certifications is on).
- Head: `h2` "Certifications"; sub "Prep steps done, in the order to take them."; Count "1/7" (passed of all), as the nav count.
- Body: a `<ul>` in rank order (today's `CERT_ORDER`). Each `<li>`: padding 12 px 16 px, 1 px `line` top border, a grid of:
  1. The name (`body-strong`, wraps) and, on the right, Count "2/4" (prep steps done), or the StatusChip "Passed" (`ok`) once the last step is done. Same chip-and-count rule as Card heads.
  2. A `small` `muted` line: the certification's `date` text exactly as on `/certs` ("December 2026", "After joining a Claude partner company"). Passed: "Passed on 3 Dec 2026" (the last step's `done_at`, IST).
  3. ProgressBar.
  - **Days left**: append " · 35 days left" (" · today", " · date passed") only for certifications that have a machine-readable target date in `content/`. None has one today (10.9), so M5a shows the date text alone. Don't parse the free text.
- From `xl` the rows sit in two columns; the left column fills first in rank order (`grid-flow-row`, so row 1 is ranks 1 and 2).
- Empty: not possible (the section always has 7 certifications). Zeros are "0/3" with an empty bar, as on Home.
- Skeleton: head blocks and four rows of a 16 px line and a 6 px bar.

### 10.3 Chart colours (new tokens)

Add to `globals.css` like the other tokens (variables in `:root` and the dark block, then `--color-kind-*` and `--color-heat-*` in `@theme inline`, so `fill-kind-roadmap` and `bg-heat-2` work). `kind-roadmap` is the `accent` value in both schemes, so the main kind keeps the brand colour.

| Token | Light | Dark | On `surface` light / dark | On `sunk` light / dark |
|---|---|---|---|---|
| `kind-roadmap` | `#0b7a68` (= `accent`) | `#3fcfb3` (= `accent`) | 5.25 / 8.82 | 4.52 / 8.09 |
| `kind-resources` (blue) | `#2f7ddb` | `#3f86f0` | 4.14 / 4.81 | 3.56 / 4.41 |
| `kind-reading` (orange) | `#923d00` | `#ec742c` | 7.27 / 5.81 | 6.25 / 5.33 |
| `kind-scaler` (violet) | `#61409e` | `#c8ccf4` | 7.68 / 10.96 | 6.61 / 10.05 |
| `kind-certs` (yellow) | `#867d00` | `#e6d14a` | 4.24 / 11.11 | 3.65 / 10.19 |
| `kind-courses` (rose) | `#d64592` | `#c0698a` | 4.10 / 4.60 | 3.53 / 4.22 |
| `kind-projects` (slate) | `#455766` | `#969cbd` | 7.48 / 6.37 | 6.43 / 5.84 |

- Every kind passes 3:1 (WCAG 1.4.11) on the card (`surface`) and on `sunk` (the current-week band behind a bar) in both schemes; lowest 3.53 (light `kind-courses` on `sunk`).
- **Colour-blind check** (computed 2026-11-26; Machado 2009 simulation at full severity for protanopia, deuteranopia and tritanopia, then CIEDE2000 between every pair). Any two kinds can touch in a bar, because a kind with nothing that week leaves no segment, so every pair was checked. Smallest difference across all four kinds of vision: **11.3 light, 10.4 dark** (about 2.3 is a just-noticeable difference; above 10 is clearly different side by side). Typical vision: 12.0 light, 13.4 dark. Hard pairs, for review: light `courses`/`projects` (protan) and `roadmap`/`projects` (deutan), 11.3; dark `reading`/`courses` (tritan), 10.4.
- Seven colours can't all be told apart by name for every reader, so colour is never the only way in: fixed stack order matching the key, 2 px gaps between segments, totals as text, and the table.
- Hue families match across schemes (teal, blue, orange, violet, yellow, rose, slate), so a kind looks like itself in dark mode.

**Heatmap steps.** One teal ramp at the accent's hue, stepped in lightness only, so it reads the same with any colour vision. More activity is darker in light mode and brighter in dark mode.

| Token | Saves that day | Light | Dark | On `surface` light / dark | Against the step below, light / dark |
|---|---|---|---|---|---|
| `heat-0` | None | `#eaefed` (= `sunk`) | `#27332f` (= `line`) | 1.16 / 1.31 (decorative: an empty day) | |
| `heat-1` | 1–2 | `#619d8f` | `#0a7b68` | 3.12 / 3.31 | 2.69 / 2.53 |
| `heat-2` | 3–5 | `#2d8271` | `#14a088` | 4.62 / 5.25 | 1.48 / 1.59 |
| `heat-3` | 6–9 | `#006857` | `#31c5aa` | 6.74 / 7.93 | 1.46 / 1.51 |
| `heat-4` | 10 or more | `#004d3f` | `#90e7d2` | 9.84 / 11.90 | 1.46 / 1.50 |

- Every active step passes 3:1 on the card, so "active" against "not active" is always visible. Fixed thresholds (not relative to the busiest day) keep a square's meaning the same from week to week, and let the key give numbers.
- Other chart pairs (existing tokens): today's outline `ink` on `surface` 16.76 / 14.29; bar baseline `line-strong` on `surface` 3.93 / 3.68; current-week band `sunk` on `surface` 1.16 / 1.10 (decorative; the bold week label carries it).

```css
/* v0.8, add to :root */
--kind-roadmap:#0b7a68; --kind-resources:#2f7ddb; --kind-reading:#923d00; --kind-scaler:#61409e;
--kind-certs:#867d00; --kind-courses:#d64592; --kind-projects:#455766;
--heat-0:#eaefed; --heat-1:#619d8f; --heat-2:#2d8271; --heat-3:#006857; --heat-4:#004d3f;
/* v0.8, add to the dark block */
--kind-roadmap:#3fcfb3; --kind-resources:#3f86f0; --kind-reading:#ec742c; --kind-scaler:#c8ccf4;
--kind-certs:#e6d14a; --kind-courses:#c0698a; --kind-projects:#969cbd;
--heat-0:#27332f; --heat-1:#0a7b68; --heat-2:#14a088; --heat-3:#31c5aa; --heat-4:#90e7d2;
```

### 10.4 The charts

Plain SVG made in a Server Component, no library. **Marks are SVG; every piece of text is HTML** laid over or beside it. Why: an SVG that scales to its box also scales its text, so labels sized for 1280 px would drop below 12 px at 320 px (the type floor, 2.4), and SVG text ignores text-only zoom. HTML labels keep the type scale and reflow.

**Weekly bar chart** (in card B).
```
 (sunk band = this week)                                   ┌──┐
      5     3     0     8     6     9     4     7     6   │ 5│   totals: num, ink (0 in muted)
     ▆▆    ▆▆          ▆▆    ▆▆    ▆▆    ▆▆    ▆▆    ▆▆   │▆▆│   stacked segments, 2 px gaps
     ▆▆    ▆▆          ▆▆    ▆▆    ▆▆    ▆▆    ▆▆    ▆▆   │▆▆│
 ────────────────────────────────────────────────────────┴──┴──  baseline, line-strong
      7    14    21    28     5    12    19    26     2    23     Monday's day: num, muted
     Sep                     Oct                    Nov            month where it changes
 ■ Roadmap tasks  ■ Learning resources  ■ Reading  ■ Courses       key, in stack order
 › Show as table
```
- **Weeks:** the current week and the 11 before it, oldest on the left. The current week is partial; that's expected.
- **Plot:** a `relative` box 160 px tall below `md`, 200 px from `md` (`H`), full width of the card's inner column. Inside it, `<svg viewBox="0 0 1200 {H}" preserveAspectRatio="none" width="100%" height="{H}" aria-hidden="true" focusable="false" class="absolute inset-0 block">`. Each week owns a 100-unit column; x stretches with the card and y is in real pixels, so gaps and the baseline stay exact. No `rx` (it would stretch).
- **Current week:** a `fill-sunk` rect behind its column (`x = i×100 + 4`, width 92, full height), its total in `font-semibold`, and its day label in `ink` `font-semibold`. No "now" text in the plot (it doesn't fit 21 px columns); the summary sentence and the table say "this week".
- **Bars:** `x = i×100 + 20`, width 60 (60% of the column: 13 px at 320, 46 px at 1280). Segments from the baseline up in kind order, each `fill="var(--kind-…)"` with `shape-rendering="crispEdges"`, 2 px apart (the background shows through). A segment is at least 3 px tall so one item stays visible.
- **Scale:** top = `max(largest weekly total, 5)`, so a quiet week doesn't look full. Usable height `H − 22` (room for the totals). No y-axis labels and **no gridlines**: every bar has its total, and gridlines would only add lines (principle 5, calm and dense).
- **Baseline:** `<line>` across the full width at `y = H − 0.5`, `stroke="var(--line-strong)"`, 1 px, `vector-effect="non-scaling-stroke"`.
- **Totals above each bar:** an `aria-hidden` overlay `absolute inset-0 grid grid-cols-12`; in each column a `relative` box with the total as `type-num text-ink`, `absolute inset-x-0 text-center`, `bottom: {bar height + 4}px`. A week with nothing shows "0" in `muted` just above the baseline.
- **Week labels** under the plot: `grid grid-cols-12 pt-1.5 text-center type-num text-muted`, two lines per column: the day of month of that week's Monday ("23"), then the month ("Nov") only on the first column and on each column whose Monday starts a new month (`&nbsp;` otherwise, so the rows line up). Drop the first column's month when column 2 already has one, so the two don't touch at 320 px.
- **Key** (direct labels don't fit 12 bars): under the week labels, 12 px gap. `<ul aria-label="Colour key" class="flex flex-wrap gap-x-4 gap-y-1.5 type-small text-ink">`; each item a 12 px square (`rounded-[3px]`, the kind's colour) and its label, gap 6 px. Only kinds with at least one completion in the 12 weeks, in stack order, so the first item in the key is the segment on the baseline. Below the key: summary and "Show as table" (10.5).

**Calendar heatmap** (in card C).
```
      Jun        Jul         Aug        Sep         Oct        Nov     months: num, muted
 Mon  ■ ■ □ ■ ■ □ □ ■ ■ ■ □ ■ ■ ■ □ ■ ■ ■ ■ □ ■ ■ ■ ■ ■ ■
      □ ■ □ □ ■ □ ■ ■ □ ■ □ □ ■ ■ □ □ ■ ■ □ □ ■ ■ ■ ■ ■ ■
 Wed  ...                                               ▣ <- today, ink outline
      ...                                               (later days of this week: no square)
 Fri
 Sat
 Sun
 SAVES PER DAY  □ None  ■ 1–2  ■ 3–5  ■ 6–9  ■ 10 or more  ▣ Today
```
- **Grid:** 26 columns (the current week and the 25 before it, oldest left) by 7 rows, **Monday at the top**. Days after today get no square.
- **It shrinks, it doesn't drop weeks.** The SVG scales to its column and all 26 weeks always show; cells are 7.1 px at 320, 9.4 px at 390 and 15.6 px from 768 (the 520 px cap). 7 px is small but still reads as a pattern, and the facts, summary and table carry the numbers. Showing fewer weeks on phones would need a second rendering and a table that disagrees with the chart.
- **Box:** `grid w-full max-w-[520px] grid-cols-[28px_minmax(0,1fr)] gap-x-1`, left-aligned in the card.
  - Row 1, column 2: the month labels, `relative h-[18px]`; each label `absolute type-num text-muted` at `left: {col / 26 × 100}%`, left-aligned. A month's label sits on the first column that contains its 1st. The leftmost column gets its month only when the next label is 3 or more columns away. Three-letter months ("Sep", never "Sept").
  - Row 2, column 1: day labels in `grid grid-rows-7`, "Mon", "Wed" and "Fri" on rows 1, 3 and 5 (`type-num text-muted leading-none self-center`); rows 2, 4, 6 and 7 empty. At 320 px a label overhangs its 8.5 px row by about 2 px into the empty rows around it, which is fine.
  - Row 2, column 2: `<svg viewBox="0 0 312 84" class="block h-auto w-full" aria-hidden="true" focusable="false">`. Each day: `<rect x={c×12+1} y={r×12+1} width="10" height="10" rx="1.5" fill="var(--heat-n)"/>` (12-unit pitch, 2-unit gap).
- **Today:** an extra `<rect x={c×12} y={r×12} width="12" height="12" rx="2" fill="none" stroke="var(--ink)" stroke-width="2" vector-effect="non-scaling-stroke"/>`, a ring in the gap around today's square. A shape, not a colour, so it reads in every scheme and colour vision. Today shows even with no saves.
- **Steps:** by saves that day (each `progress_event` row; before 26 Nov 2026, items whose `done_at` is that day): 0 → `heat-0`, 1–2 → `heat-1`, 3–5 → `heat-2`, 6–9 → `heat-3`, 10 or more → `heat-4`.
- **Key** under the grid, 12 px gap, as for the bar chart: `<ul aria-label="Colour key">` preceded by the `label`-type text "Saves per day", then 12 px squares labelled "None", "1–2", "3–5", "6–9", "10 or more", and "Today" with an outlined square (2 px `ink` ring on `surface`).

**Progress: bars, not rings.** Current phase and each certification use the existing ProgressBar (6 px, `accent` on `sunk`, `aria-hidden`, the Count beside it says the same). Rings would be a new component, need a number inside to be readable, and take more room per row; bars line up in a list and match Home.

### 10.5 Chart accessibility

Each chart block has this structure:
```
<div role="img" aria-label="{name}">  …plot, labels and overlays, all aria-hidden…  </div>
<ul aria-label="Colour key">…</ul>
<p class="sr-only">{summary sentence}</p>
<details> <summary>Show as table</summary> <table>…</table> </details>
```
- **`role="img"`** on the box that holds the SVG and its HTML labels, so the whole picture is one object. Names: "Bar chart of items done per week, last 12 weeks" and "Calendar of active days, last 26 weeks".
- **Summary sentence**, visually hidden, right after the key (so it is read after the name and before the table):
  - Bar chart: "Over the last 12 weeks you marked 38 items done. This week so far: 5; last week: 7. Busiest week: week of Mon 2 Nov, with 9. Most were roadmap tasks (15)." Ties for the busiest week: the most recent. Drop "Most were…" when only one kind is shown.
  - Heatmap: "48 of the last 180 days were active. Last 30 days: 12 active days. Busiest day: Thu 26 Nov, with 14 saves. Today: 3 saves so far." ("Today: no saves yet." for none.) 180 is the number of days in the grid up to today.
- **"Show as table"**: a native `<details>` (no heading inside it, so the v0.2 concern about `<summary>` doesn't apply, and its state needn't be stored). Closed on every load.
  - `<summary>`: `group flex min-h-11 w-fit items-center gap-1.5 rounded-sm type-small font-semibold text-accent`, the Caret (section 4) turning with `group-open:rotate-90` (`motion-safe` transition, as elsewhere), and two spans that swap with `group-open:hidden` / `hidden group-open:inline`: "Show as table" and "Hide table". The hidden span is `display: none`, so the accessible name follows the visible text; the browser announces expanded or collapsed. Shared focus ring.
  - Table: the admin "Sign-ups per week" style (5, Overview): `w-full table-fixed border-collapse`, `<caption class="sr-only">`, `<th scope="col">` in `label` `muted` with a 1 px `line` bottom border, the week as `<th scope="row">` (`type-num font-medium`), rows at least 44 px with 8 px vertical padding when a cell wraps, 1 px `line` dividers, cell padding 8 px (`px-2`; the admin table's `px-3` doesn't fit 320 px), numbers right-aligned in `num`. **Newest week first**, like the admin table.
  - **Done per week table.** Caption "Items done per week, last 12 weeks, newest first". Columns: **"Week of"** (72 px; "23 Nov", and for the current week a second line "this week" in `small` `muted`), **"Done"** (56 px, right-aligned), **"By kind"** (the rest, `small`): the non-zero kinds in stack order, "Roadmap tasks 2 · Learning resources 3", or "Nothing done" in `muted`.
  - **Active days table.** Caption "Active days per week, last 26 weeks, newest first". Columns: **"Week of"** (72 px, as above), **"Active days"** (72 px, right-aligned; its header wraps to two lines), **"Saves by day"** (the rest, `small`): "Mon 3 · Wed 1 · Sat 5", or "No activity" in `muted`. The estimate line (10.2 C) above the summary covers the older rows.
  - At 320 px the free column gets about 110 px and wraps to two or three lines; nothing scrolls sideways.
- **No hover, no tooltips, no focusable marks.** The table gives exact numbers to everyone, so the charts stay pictures. Tab order inside a chart card: "Show as table", then the table's content (no controls).
- **Motion:** the charts never animate, with or without reduced motion: no grow-in, no hover effects. Only the existing ProgressBar width and Caret transitions, already `motion-safe`, and the skeleton pulse.
- **Colour:** see 10.3; the key always has text, the heatmap key has numbers, today is an outline, and the current week is a band plus bold text.

### 10.6 Loading, errors and offline
- **Loading:** the header renders at once (the "This week" fact shows "–"); everything else is one `InsightsSkeleton` (add to `Skeleton.tsx`, using its `Wrapper`, so it gets `aria-busy`, the hidden "Loading" and the 3 s "still loading" line). It draws the blocks of 10.2 in page order at their real sizes, with the `xl` pair side by side and the Certifications card included (it is on for most people; if it turns out off, the page only gets shorter).
- **Page error:** the existing page error card ("This page didn't load." with Try again and Go to Home), from the route group's `error.tsx`.
- **Offline:** the usual warning banner; the page is read-only anyway, so nothing else changes. It shows what loaded last.
- **Signed out:** as every page (to `/login?next=/insights`).

### 10.7 Navigation and the Home link
- **Label** "Insights", **icon** a new `ChartColumnIcon` in `components/icons.tsx` (Lucide "chart-column", ISC licence like the others; nothing in the current set says "chart"). Paths, to be checked against the Lucide source when copied: `M3 3v16a2 2 0 0 0 2 2h16`, `M18 17V9`, `M13 17V5`, `M8 17v-3`. A column chart says "weekly numbers" more plainly than a trend line, and matches the main chart.
- **Sidebar** (from `lg`): the second link of the first group, right after Home, no count, same NavLink look; current on `/insights`. It is not part of `SECTIONS` (that list feeds the bottom bar's first three cells); add it like `SETTINGS_ITEM`, for example an `INSIGHTS_ITEM`, rendered after Home. The owner then has 11 links; the sidebar's existing scroll takes over below about 780 px of window height, and 1280×900 still fits.
- **Phone and tablet:** the bottom bar is unchanged for everyone. In the More sheet, Insights is the **first row**, above the visible sections not in the bar (sidebar order, with Home already in the bar), then the divider, Settings, Admin and the account row. When no section is left for the sheet, Insights is still first, then the divider. Opening the sheet focuses Insights. More takes the current style on `/insights` (add it to `moreIsCurrent`).
- **Home link** (section 5, Home, step 3a). Between the tiles and the NowPanel, at both widths:
  ```
  [chart icon]  This week: 5 done · 3-week streak   Insights →
  ```
  - One link to `/insights`: `flex min-h-11 w-fit max-w-full flex-wrap items-center gap-x-2 rounded-sm type-small` (wraps under itself at 320 px; the whole line is the target). Content: `ChartColumnIcon` 18 px in `accent` (decorative); the text in `ink`, `font-medium`, numbers in `type-num`; then "Insights" in `accent`, underlined, followed by an `aria-hidden` "→". Hover: the text turns `accent`, as the NowPanel links do.
  - Copy: "This week: 5 done · 3-week streak"; "1-week streak"; no streak: "This week: 0 done · no streak yet". Accessible name is the visible text ("This week: 5 done · 3-week streak Insights"), which says where it goes.
  - Same numbers as the Insights tiles: computed by the same functions in `lib/insights.ts` from the progress rows Home already reads, with the same hidden-section rule. Inside Home's existing Suspense boundary; the Home skeleton gets a 44 px row with a 14 px line at 40% between the tiles and the panel.
  - Why there: the tiles say where you stand overall, this line says how this week is going, and the NowPanel says what's next; it reads in that order, it's a real 44 px target (a link inside the facts row would be 13 px text), and it is above the fold on a 390×844 phone.

### 10.8 Copy

| Where | Copy |
|---|---|
| Nav, `<title>`, `h1` | "Insights"; `<title>` "Insights · FDE Journey" |
| Description | "How your learning is going, week by week. Weeks run Monday to Sunday in India Standard Time (IST)." |
| Fact | "This week" "Mon 23 Nov – Sun 29 Nov" |
| Tiles | "5" "done this week · 7 last week"; "3" "weeks in your current streak" (1: "week in your current streak"); "6" "weeks in your longest streak"; hints "Mark something done this week to keep it going." / "Mark something done this week to start one." |
| Streak definition (once) | "A streak counts the weeks in a row, Monday to Sunday, in which you marked at least one item done. This week joins your streak as soon as you do." |
| Hidden sections | "Hidden sections aren't counted here: Scaler course and Projects." Link "Show them in Settings" ("Show it in Settings" for one) |
| Done per week | `h2` "Done per week"; sub "Last 12 weeks. An item counts in the week you marked it done; if you untick it, it leaves the chart."; empty "Nothing marked done in the last 12 weeks. Tick your first item to start your weekly chart." + "Go to the Roadmap" |
| Kind labels | "Roadmap tasks", "Learning resources", "Reading", "Scaler classes", "Certification prep", "Courses", "Projects and career" ("Projects" or "Career" alone) |
| Active days | `h2` "Active days"; sub "Last 26 weeks. A day is active when you tick or untick an item, or save a note or link."; facts "Last 30 days" "12 active days", "Last 26 weeks" "48 active days"; empty "No activity in the last 26 weeks yet. Each day you tick an item or save a note fills in a square here." |
| Estimate line | "Days before 26 Nov 2026 are estimated from when items were marked done, so they may show less than you did." |
| Heatmap key | "Saves per day": "None", "1–2", "3–5", "6–9", "10 or more", "Today" |
| Chart names (`aria-label`) | "Bar chart of items done per week, last 12 weeks" / "Calendar of active days, last 26 weeks" |
| Summaries (hidden) | See 10.5 |
| Disclosure | "Show as table" / "Hide table" |
| Table captions and columns | "Items done per week, last 12 weeks, newest first": "Week of", "Done", "By kind" ("Nothing done"; current week "this week"). "Active days per week, last 26 weeks, newest first": "Week of", "Active days", "Saves by day" ("No activity") |
| Current phase | `h2` "Current phase"; sub "Phase 2 · RAG and retrieval"; facts "Ends" "Tue 15 Dec · 6 days left" / "· last day"; "Projected finish" "Sat 12 Dec · 3 days before it ends" / "· on its last day" / "Fri 18 Dec · 3 days after it ends" / "Not enough recent activity"; lines "At your pace over the last 4 weeks: 6 roadmap tasks done." / "Mark at least 2 roadmap tasks done within 4 weeks to see a projected finish." / "All tasks in this phase are done."; outside the roadmap "The roadmap starts on 24 Nov 2026." / "The roadmap's last phase ended on 15 Feb 2027." + "Go to the Roadmap" |
| This month | `h2` "This month"; sub "Since 1 Nov"; "items with a note or link saved", "learning resources finished"; November 2026 only "Notes are counted from 26 Nov 2026, when the app started recording them."; both zero "Notes you save and learning resources you finish this month will show here." |
| Certifications | `h2` "Certifications"; sub "Prep steps done, in the order to take them."; row line: the `/certs` date text, or "Passed on 3 Dec 2026"; with a target date later: " · 35 days left" / " · today" / " · date passed" |
| Home link | "This week: 5 done · 3-week streak" / "1-week streak" / "This week: 0 done · no streak yet"; then "Insights →" |

Numbers as digits; "1 item", "1 week", "1 day" in the singular. "Saves" is the plain word for activity events: every tick, untick, or note or link save is one save.

### 10.9 Open questions (for the lead)
1. **Certification days left.** The scope asks for each certification's target date and days left, but `Cert.date` is free text ("December 2026", "April 2027 or later, when practice exams say ready", "After joining a Claude partner company"). Proposal: an optional `targetDate` ("YYYY-MM-DD") on `Cert` in `content/` (adding a field doesn't touch ids), filled only where the owner has a real date; rows without it show the text alone. Until then M5a shows no "days left". Parsing the text was rejected: "December 2026" has no day, and a guess would be presented as a fact.
2. **Pace for the projection.** `M5-DESIGN.md` says "completions over the last 4 weeks" without a kind. This spec uses **roadmap tasks** only, because the phase total counts roadmap tasks; counting resources, papers and classes would project a finish for tasks that weren't done. Confirm.
3. **"Notes saved" counts items, not saves.** Notes save 800 ms after typing stops, so one note can write many events. The card counts distinct items with a note or link saved this month. Confirm with the back end that `progress_event` can tell a note or link save from a tick.
4. **Week labels** use the IST Monday's date; with M5b's personal time zones they'd follow the person's zone. Nothing to do now.

## Later (not M1 to M3)

**M6 Job applications (sketch only; needs its own design note before build, as the plan says; it was M4 before multi-user took that slot)**
- Route `/applications`. Desktop: sidebar item after Career with an "active" count. Phone: first row of the More sheet.
- Fields: company (required, up to 100 characters), role (required, up to 100), posting link (`https` only), source (select: Company site, Job board, Referral, Recruiter, Other), location (free text, for example "Remote"), status (select, below), applied on (date), next step (up to 120 characters), next step due (date), notes (long text). Created and updated dates are automatic. No fields for other people's contact details (names, emails, phone numbers).
- Statuses and chips: Saved (neutral), Applied, Screening, Interviewing (ok), Offer (now), Rejected, Withdrawn (neutral, row text `muted`). Next step due before today: warn chip "Overdue".
- List, phone: one card per application: company (`body-strong`), role (`small`), status chip, "Next: {next step} · {due date}" with the overdue chip if needed. Desktop: a table with Company, Role, Status, Next step, Due, Updated, sortable by due date. Default sort: due date soonest first, then closed applications last.
- Toolbar: search plus a status filter (All, Active, Closed, then each status). Primary button "Add application" opens a form page; each row opens its edit page; delete needs a confirm step.
- Made-up example row: "Example Corp · AI Engineer · Applied · Next: take-home task · 4 Dec".
- Empty: "No applications yet." Button: "Add application".

**Scaler: open the new current module once.** When the course moves on to the next module, add that module to the stored open list once (and remember that it was added), so the new module is open without undoing the owner's other choices. Today, once anything is stored, the new current module stays closed until the owner opens it, as in the tracker.

**From D1 (v0.4), not planned yet:**
- `/login` offline: a warning banner "You're offline. Signing in needs a connection." and the button disabled.
- More items in the account panel when they exist. (v0.5: Settings and Admin went to the sidebar and the More sheet instead, section 3.5; data export and the privacy page are reached from Settings.)
- A right-hand column on Home from 1440 px, once M5 gives it something to show (weekly insights); until then Home stays one 960 px column. v0.8: still Later. M5a gives Home one link line (section 10.7), not a block worth a column, and Insights itself stays one 960 px column (section 10.1).
- A sticky phase index beside `/roadmap` on wide screens.
- A favicon that switches colour with the browser theme.

**From M4b (v0.5), not in M4:**
- Settings: the weekly target and the time zone (M5). A card "Weekly goal" between Sections and Your data, when M5 needs it.
- Google sign-in (after M4, owner decision 2026-11-26): a second full-width secondary button "Continue with Google" under the GitHub button on `/login`, with the fine print rewritten per provider; the delete confirmation would then need something other than the GitHub username (for example typing "delete").
- Email notices (for example "You're in" when someone is let in from the waitlist). Until then the waitlist page says to check back.
- A one-time "You're in" banner on Home for someone just let in from the waitlist.
- Users table: sorting (last active, most done) and an export of the counts.
- Admin: deleting a suspended account on request (today only the person can delete their own account; see open questions).
- Not storing the email address at all (GitHub shares it, but nothing uses it).
- A bot check before taking a place (minimum GitHub account age, or a challenge), only if bots fill places (`M4-DESIGN.md` section 7).

**From Courses & badges (v0.7), not planned:**
- A Courses switch in Settings, if people ask to hide it (`COURSES.md` build notes: needs a `user_settings` column and a migration). Then the 3-tile Home grid returns (section 5, tile grid) and Courses joins the hidden-section banner and the first-visit sentence.
- The Badge tag reading "Badge earned" once the course is ticked (only from the tick: the app can't check the badge itself).
- Grouping the page filter's phase options under an `<optgroup label="Roadmap phase">`.

**From Insights (v0.8), not in M5a:**
- M5b (needs the owner's yes, `M5-DESIGN.md`): a weekly target, shown as a dashed target line across the weekly chart and as "5 of 8" on the This week tile; the "Weekly goal" card in Settings (above).
- Hover or tap details on a heatmap day or a bar (a small popover with the date and counts). Left out because the tables already give every number and a popover needs client code and its own focus rules.
- A phase burn-up line, if the weekly chart isn't enough (`M5-DESIGN.md`, out of scope).
- A key that filters the chart to one kind.

**Other ideas, not planned:** a light, dark or system theme switch; a "Jump to current phase" link on `/roadmap`; a sticky toolbar on long pages; search across all sections; the installable phone app from the plan's list; a browser "leave page?" warning while a note change is unsaved, or keeping unsaved note text in the browser until it saves (text typed offline is lost if the page closes first); a "Go to it" action on the save-failed banner that scrolls to the first failed item.
