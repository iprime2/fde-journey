# FDE Journey web app: design spec (v0.3)

Status: for M1 and later. v0.1 written 2026-11-25 against `PLAN.md` v0.1, which the owner approved on 2026-11-25 (GitHub sign-in for the owner's account only; job applications are the first new section after go-live; four agents plus one skill). v0.2 written 2026-11-25 after the M1 screen review. v0.3 written 2026-11-26 after the M2 screen review.
Read with `.claude/skills/journey-app-dev/SKILL.md`. If this spec and the plan disagree, the plan wins; tell the lead.

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
5. **Calm and dense.** About 400 items live in long lists. Keep the chrome quiet: no shadows on cards, no decoration, mono type for numbers only.

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
| `danger-soft` (new) | `#fdeceb` | `#3d1915` | Error banner background |

Dark mode follows the system setting (`prefers-color-scheme`). Set `color-scheme: light dark` so native controls match, and add `<meta name="theme-color">` for both schemes (`page` values).

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

Lowest text pair: 4.52 (light `accent` on `sunk`). Lowest UI pair: 3.37 (dark `line-strong` on `sunk`). `line` on `surface` is 1.33 (light) and 1.31 (dark); it is only used for decorative dividers and must never be the only border of a control. Disabled controls are exempt from contrast rules but must still look disabled (section 4).

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
}
@media (prefers-color-scheme: dark) { :root {
  --page:#0e1412; --surface:#151d1a; --sunk:#1b2521; --hover:#1f2a26;
  --ink:#e4ece9; --muted:#93a39d; --line:#27332f; --line-strong:#667872;
  --accent:#3fcfb3; --accent-hover:#5fdcc3; --accent-ink:#06211b; --accent-soft:#143a32;
  --warn:#f0b35a; --warn-soft:#3a2b13; --danger:#ff958a; --danger-soft:#3d1915;
  --overlay-shadow: 0 8px 24px rgb(0 0 0 / 0.5);
} }
@theme {
  --color-*: initial;   /* drop Tailwind's default palette */
  --font-display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 12px;
}
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

Nothing smaller than 12 px. Body text lines stay under about 75 characters (descriptions `max-w-[65ch]`; row meta and why lines `max-w-[75ch]`).

### 2.5 Spacing, radius, shadow, motion, breakpoints
- **Spacing**: Tailwind's default 4 px scale. Use 4, 8, 12, 16, 20, 24, 32, 40, 64 px only. Card padding 16 px; gap between cards 12 px; gap between page sections 20 px (phone) and 24 px (desktop).
- **Radius**: `sm` 6 px (focus ring, skeleton blocks), `md` 10 px (fields, buttons, resource list box), `lg` 12 px (cards, tiles, panels, sheet), `full` (chips, progress bar).
- **Shadow**: cards and tiles have none, only a 1 px `line` border. `shadow-overlay` is only for the "More" sheet and the focused SkipLink.
- **Motion**: 150 ms ease-out for colour changes, 200 ms for caret rotation, 300 ms for progress-bar width. Nothing else moves. Colour transitions list their properties (`transition-[color,background-color,border-color]`), not Tailwind's `transition-colors`, which also animates `outline-color` and makes the focus ring fade in from the text colour. The focus ring always appears at once. Under `prefers-reduced-motion: reduce` all of it is off (use Tailwind's `motion-safe:`), including skeleton pulsing.
- **Breakpoints**: Tailwind defaults. Below `lg` (1024 px) is the phone layout; `md` (768 px) only changes grids. Layouts must also work at 320 px with no sideways scrolling.

## 3. Layout

### 3.1 Phone and tablet (below 1024 px)
- Set the viewport to `viewport-fit=cover` (Next.js `viewport` export, `viewportFit: "cover"`) so the safe-area insets below work on phones with a notch.
- No top bar. The page header is the first thing on screen; pad the top with `max(24px, env(safe-area-inset-top))`.
- **Bottom bar**, fixed: `surface` background, 1 px `line` top border, height 64 px plus `env(safe-area-inset-bottom)`. Five equal cells: **Home, Roadmap, Reading, Scaler, More**. Each cell is a 22 px icon above a `tab-label`, the whole cell is the target (at least 48 px tall). Default colour `muted`. Current page: icon and label `accent`, a 3 px by 24 px `accent` pill above the icon, and `aria-current="page"`. Focus ring inset (`outline-offset: -2px`) so the bottom edge of the screen never clips it.
- **More** is a button (`aria-expanded`, `aria-controls`). It opens a sheet above the bar: `surface`, `lg` top corners, `shadow-overlay`, over a scrim of `rgb(0 0 0 / 0.3)`. Rows 52 px tall: Certifications, Projects, Career, then a divider and Sign out (M2 onwards). It closes on choosing a row, on Escape and on tapping the scrim; focus goes to the first row on open and back to More on close. When the current page is in the sheet, More takes the current style.
- Side padding `max(16px, env(safe-area-inset-left/right))`. Bottom padding 24 px plus the bar height, so the last row is never hidden.
- Set `scroll-padding-bottom: calc(64px + env(safe-area-inset-bottom) + 16px)` on `html` below `lg`, so a control reached with Tab (or scrolled to with `#item-…`) is never hidden under the bar. Without it, the M2 review found 8 of 40 Tab stops on `/roadmap` at 390 px hidden behind the bar (WCAG 2.4.11).

### 3.2 Desktop (1024 px and wider)
- **Sidebar**, fixed on the left, 248 px wide, full height, `surface` with a 1 px `line` right border, padding 24 px by 16 px.
  - Top: eyebrow "AI Engineering & FDE" (`label`, `accent`), app name "FDE Journey" (`title`).
  - Nav: Home, Roadmap, Reading, Scaler course, Certifications, Projects, Career (today's tab order). Each link is 44 px tall, `md` radius, 20 px icon, label (`body-strong`) and a right-aligned count (`num`, `muted`) as on today's tabs. Hover: `hover` background. Current: `accent-soft` background, `ink` label, `accent` icon, `aria-current="page"`.
  - Bottom, pinned: "Readiness review · N days left" (`small`, `muted`) and a ghost "Sign out" button (M2 onwards).
- **Main area**: left margin 248 px; content column at most 960 px wide, centred in the remaining space; padding 40 px top, 32 px sides, 64 px bottom.

Nav counts (same as today's tabs): Roadmap = roadmap tasks done (`l` ids only); Reading = papers and books done; Scaler course = classes done; Certifications = passed of 7; Projects = complete of 3; Career = career milestones done. Home has none.

Icons: one set, line style, 1.75 px stroke, always next to a visible label, `aria-hidden`. Suggested `lucide-react` (1.80.0 on npm on 2026-11-25; adding it is the lead's call): house, map, book-open, graduation-cap, award, folder-git, briefcase, ellipsis.

### 3.3 Page frame and grid
Every page: page header, banner area, then content. Content is a single column of cards. Grids: summary tiles 2 columns below `md`, 3 columns from `md`; certification cards 1 column below `md`, 2 from `md`; current-phase panel 1 column below `md`, 2 columns (`1.1fr 1fr`) from `md`.

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

## 4. Components
Shared rules:
- Focus ring: `outline: 2px solid accent; outline-offset: 2px` on `:focus-visible`. Never removed, never transitioned (section 2.5). Exceptions: bottom-bar cells use `outline-offset: -2px` (section 3.1), and the Scaler card head draws the ring for its button (CollapsibleCard).
- Disabled means `opacity: 0.5`, `cursor: not-allowed`, and the native `disabled` attribute.
- Controls (buttons, fields, selects, tick boxes, summaries, nav items, tiles, the skip link) have hit areas at least 44 by 44 px, even when the visible shape is smaller (extend with padding or an inset `::before`).
- Text links inside rows or sentences (item titles, note links, the "Sign in" link in a banner) follow WCAG 2.5.8 instead: at least 24 by 24 px, or spaced so that a 24 px circle centred on each one does not overlap another target. One-line title links are about 19 px tall and pass by spacing.
- Inline text buttons ("Try again", "Fix link", "Fix note") are controls, so they get the 44 px rule: `inline-flex min-h-11 items-center` (the line that holds them grows to 44 px), underlined, `font-sans`, in the colour of their line. M2 built them 18 px tall.
- A control that disappears when it has done its job must move focus first, never leave it on the page body. Each component says where focus goes.

**SkipLink.** "Skip to content", the first focusable element on every page that has the sidebar or bottom bar; it targets `<main id="main">`. Visually hidden until focused (hidden with the `sr-only` technique, never `display: none`). When focused: fixed 12 px from the top and left, above everything (`z-50`), at least 44 px tall (`inline-flex items-center`, padding 0 16 px), `surface` background, 1 px `line-strong` border, `md` radius, `shadow-overlay`, `body-strong` in `accent`. In Tailwind, `focus:not-sr-only` resets padding to 0, so set the padding with `focus:` utilities after it. States: hidden, focused.

**PageHeader.** Optional eyebrow (`label`, `accent`), `h1` (`display`), optional description (`small`, `muted`, 65ch), optional facts. The `h1` gets `tabindex="-1"` so focus can move to it after navigation, and `w-fit` so the focus ring (shown after keyboard navigation only) hugs the title instead of spanning the column. States: default only.

**Facts.** A `<dl>` that wraps: `dt` in `label`/`muted`, `dd` in `small` at weight 500, `ink`. Gap 8 px by 18 px. Loading: `dd` shows "–" until the client has computed it.

**Banner.** Full-width strip, `md` radius, padding 10 px by 14 px, `small` text, optional action after the message: an underlined link at weight 600 when it goes to another page ("Sign in" goes to `/login?next={this page}`), an inline text button when it acts on the page. Variants: info (`ink` on `sunk`, `role="status"`), warning (`warn` on `warn-soft`, `role="status"`), error (`danger` on `danger-soft`, `role="alert"`). Banners have no close button: each goes away when its cause does ("Back online." hides itself after 4 s). Show at most two, highest first: error, warning, info.

**StatTile.** A link card to its section: `surface`, `line` border, `lg` radius, padding 14 px by 16 px. Number (`num-lg`), label (`small`, `muted`), ProgressBar. Hover: border `line-strong`. Focus: ring. Loading: skeleton. Zero is not special: "0/57" and an empty bar.

**ProgressBar.** 6 px tall, `full` radius, `sunk` track, `accent` fill, width animates (motion rule). `aria-hidden="true"` because the number beside it already says the same.

**StatusChip.** `label` type, padding 3 px by 8 px, `full` radius, always has text. Variants: neutral (`muted` on `sunk`), ok (`accent` on `accent-soft`), now (`accent-ink` on `accent`), warn (`warn` on `warn-soft`). Labels: phases Complete / This phase / Behind / Upcoming; modules Complete / Current / In progress / Not started; certifications Passed or their priority (First, Second, Third, Optional, When eligible, Parked); projects Complete / In progress / Not started.

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
- Text column: optional index (`num`, `muted`: "M1·01", "1.", "Week of 30 Nov"), title (`body-strong`; a link when the item has a URL, `accent`, underline offset 2 px, opens in a new tab with a small "↗" and visually hidden "(opens in a new tab)"), meta (`small`, `muted`), "why" line (`small`, `muted`). Meta and why lines are capped at `max-w-[75ch]`; the title can use the full width.
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
- Both stored in the URL (`?q=` and `?status=`, replace, don't push) so reload and Back keep them. A visually hidden live region says "{n} items shown" 400 ms after the last change.
- "Clear search and filter" (in EmptyState) empties both, then moves focus to the search field: the button disappears with the empty state, and focus must not fall back to the page body.

**EmptyState.** Centred `small` `muted` text on `surface` with a 1 px dashed `line` border, `lg` radius, padding 28 px, plus an optional secondary button. Which message shows (section 8): "With notes" and no notes → the no-notes message; "Done", search empty and nothing on the page done → "Nothing marked done yet." (no button); anything else → "Nothing matches this search or filter." with "Clear search and filter".

**Skeleton.** `sunk` blocks with `sm` radius in the shape of the content. It covers only what waits for data: the toolbar block and the cards (Home: six tiles and the panel). The page header is static, so it renders at once, with Facts showing "–" until the client has computed them. Pulses (opacity 1 to 0.6, 1.2 s) only with `motion-safe`. The wrapper has `aria-busy="true"` and a visually hidden "Loading".

**Button.** 44 px tall, `md` radius, padding 0 16 px, `body-strong`. Primary: `accent` / `accent-ink`, hover `accent-hover`. Secondary: `surface`, 1 px `line-strong` border, `ink`, hover `hover`. Ghost: no border, `muted` text, hover `hover` background and `ink` text. Loading: label changes (for example "Opening GitHub…"), `aria-busy`, disabled. Disabled: shared rule.

**GroupLabel.** `label`, `muted`, 8 px top margin ("Core modules", "Elective modules"). Hidden when nothing under it matches the filter.

**NowPanel** (Home). A card with two parts. Left: kicker "Roadmap · {phase dates}" (`label`, `muted`), `h2` "Phase {n} · {title}" plus StatusChip, "x/y tasks done" (`num`), ProgressBar; then kicker "Scaler · Module {n}", "{title}: {subtitle}", "x/y classes · next: {class}". Right: kicker "Up next this phase" and the first three tasks not yet done, each a link to `/roadmap#item-{id}` with an `accent` "→". Empty: "All tasks in this phase are done."

**JournalEditor** (Weekly notes on Career). Card head "Weekly notes" with its sub line; one textarea (min 160 px) labelled by the card heading; status line, announcements, offline and read-only behaviour as in NoteEditor (the status line is in the DOM from page load). It never closes, so there is no collapsed state. Try again moves focus to the textarea first.

**SignInCard** (`/login`). See section 5.

## 5. Pages
Each page has its own `<title>`: "{Page} · FDE Journey" ("FDE Journey" on Home). Order is the same at 390 px and 1280 px unless stated; at 390 px everything is one column.

**`/` Home**
1. PageHeader: eyebrow "AI Engineering & FDE · 24 Nov 2026 – 15 Feb 2027"; `h1` "FDE Journey"; facts "Scaler classes: Mon · Wed · Fri, 09:00–11:30 IST", "Next class: {value}", "Readiness review: 15 Feb 2027 · N days left". At 1280 px the facts sit on one line.
2. Banners.
3. Six StatTiles, in today's order: Roadmap milestones (percent; label "x of y roadmap milestones"), Technical learning, Learning resources studied, Scaler classes (label "Scaler classes · now Module n"), Certifications passed (x/7), Portfolio projects complete (x/3). Links: the first three go to `/roadmap`, then `/scaler`, `/certs`, `/projects`. 2 by 3 at 390 px, 3 by 2 at 1280 px.
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
4. Cards in rank order (today's `CERT_ORDER`), 1 column at 390 px, 2 columns at 1280 px. Head: `h2` name, sub "{date} · {status}", StatusChip, Count; description; step rows without meta.

**`/projects`**
1. PageHeader: `h1` "Projects"; description "Three portfolio projects. A project is complete when every step is ticked."
2. Banners. 3. Toolbar.
4. Three Cards: `h2` name, sub line subtitle, StatusChip, Count, description, step rows.

**`/career`**
1. PageHeader: `h1` "Career".
2. Banners. 3. Toolbar.
4. Card "Career milestones" (sub "Apply while learning; don't wait for every certification.", Count): rows with meta "{date} · {description}".
5. JournalEditor card "Weekly notes" (sub "Blockers, next actions, exam dates, weekly reflections."). It shows under the filters "All items" and "With notes" only, as today.

**`/login`** (no sidebar or bottom bar)
- One centred column, max 400 px; 64 px from the top on a phone, vertically centred on desktop.
- Eyebrow "AI Engineering & FDE", `h1` "FDE Journey", text "A private tracker for an AI engineering and Forward Deployed Engineer (FDE) learning journey. Only the owner's GitHub account can sign in."
- Primary button, full width: GitHub mark plus "Sign in with GitHub". Loading: "Opening GitHub…", `aria-busy`, disabled. While the part of the page that reads the address streams in, the button shows disabled with no message (a split second).
- Banner area under the button for the messages in section 8: `?error=not_owner` gives the "not allowed" error; any other `?error=` gives "Sign-in didn't finish. Try again."; `?status=signed-out` gives the info banner "You're signed out.".
- M1 only (removed in M2): the button is disabled, an info banner says "Sign-in isn't available yet. It comes with saving progress.", and a secondary "Go to Home" link-button sits under the banner, so the page is not a dead end.

**Not found** (`not-found.tsx`; no sidebar or bottom bar; `<title>` "Page not found · FDE Journey")
- The `/login` layout: one centred column, max 400 px.
- Eyebrow "AI Engineering & FDE" (`label`, `accent`) and the app name "FDE Journey" (`title`, a paragraph, not a heading), so the owner can tell they are still in the app.
- A card with `h1` "This page doesn't exist." (`title` size) and a primary "Go to Home" button.

## 6. States

| State | When | What the owner sees | Behaviour |
|---|---|---|---|
| Read-only preview | M1 only | Info banner on every page: "Read-only preview. Ticks and notes can't be saved yet." | Tick boxes and weekly notes disabled; no note buttons (they arrive in M2). The first-visit banner is not shown. Search, filter, open and close, tiles and countdown work |
| Signed out | Any page without a valid sign-in | Nothing from the page; goes straight to `/login?next={path}` | After sign-in, return to `next`. No flash of content |
| Not the owner | Sign-in with another GitHub account | `/login` with the "not allowed" error | No account is kept for that user |
| Signed out while using | A save is refused for sign-in reasons | Error banner with a "Sign in" link | Write controls disabled; note fields read-only but readable (NoteEditor), so typed text can be copied before leaving. Typed note text stays in place until the page is left |
| First visit, no progress | No progress saved yet | Zeros and empty bars; NowPanel shows today's phase with its first three tasks; info banner on Home only, and not while the read-only banner shows (it asks for ticks that can't be saved yet) | Banner disappears once anything is saved (based on data, not a dismiss) |
| Loading | A page is waiting for data | The page header renders at once (facts show "–" until computed). Skeleton for the rest: toolbar block, then three cards of four rows (Home: six tiles and the panel). After 3 s add the "still loading" line | Navigation stays usable. The free database sleeps after 5 idle minutes, so the first load can be slow |
| Saving | Tick or note change | Ticks change at once; notes show "Saving…" (in a closed row only after 1 s) | Ticks are optimistic |
| Save failed | A save errors while online | Inline message with Try again on the item (in the collapsed row too, NoteEditor) and one error banner for the page | Tick goes back to its saved value; note text is kept and shown. Banner stays until every failed item is saved or the page is left |
| Offline | Browser reports offline | Warning banner. Unsaved notes show "Not saved yet. Saves when you're back online." | Tick boxes disabled; note and Weekly notes fields stay editable and their changes wait. Reading, search and filter work. The save-failed banner is hidden while offline (Try again can't work; the offline banner explains). Back online: info banner for 4 s, tick boxes enabled, waiting and failed note changes save by themselves once; failed ticks keep their Try again |
| Page error | Server error while rendering | Card "This page didn't load." with "Try again" (primary) and "Go to Home" (secondary) | `error.tsx` per route group |
| Not found | Unknown address | The `/login` layout with the app name, then "This page doesn't exist." and "Go to Home" (section 5) | `not-found.tsx` |

## 7. Accessibility
The conventions checklist, applied:

| Check | How it applies here |
|---|---|
| Text contrast at least 4.5:1 | Every text pair in 2.2 passes in both schemes; lowest 4.52. Field borders, tick boxes, focus ring and progress fill are 3:1 or more |
| Visible focus | 2 px `accent` ring with 2 px offset on every interactive element, including disclosure buttons, tiles, nav links, the tick box and the Scaler card heads. It appears at once (no `outline-color` transition), is inset on bottom-bar cells, and hugs the `h1` (`w-fit`) after navigation. Never `outline: none` without a replacement. Below `lg`, `scroll-padding-bottom` keeps the focused control above the bottom bar (section 3.1) |
| Full keyboard use | SkipLink "Skip to content" first on every page, at least 44 px tall when focused. Tab order follows reading order; in a row: tick, title link, note button, note link, Learning resources. Space ticks; Enter and Space open and close disclosure buttons; Escape closes the More sheet and the note editor (focus back to the note button). After client navigation, focus moves to the page `h1`. After "Clear search and filter", focus moves to the search field. After Try again: tick line to the tick box, note to the note button, Weekly notes to its textarea. Focus never falls to the page body |
| Labelled controls | Tick boxes "Mark done: {title}" (contains the visible title). Search, filter, note and link fields have labels (visually hidden is fine). Icon-only controls do not exist; bottom-bar icons sit above visible labels |
| Touch targets at least 44 px | Applies to controls: tick cell 44 by 44; note button, disclosure buttons, fields, select, buttons, inline text buttons (Try again, Fix link, Fix note), nav links, skip link 44 px; Scaler card heads 56 px; bottom-bar cells 48 px; More sheet rows 52 px. Text links in rows and sentences follow WCAG 2.5.8 (24 px, or spaced so a 24 px circle on each does not overlap another target); one-line title links pass by spacing |
| Reduced motion | All transitions and the skeleton pulse are off under `prefers-reduced-motion` |
| Structure | Landmarks: `nav` (sidebar or bottom bar, "Sections"), `main`. One `h1` per page; cards use `h2`. On Scaler the `h2` holds the disclosure button; never put a heading inside a `<summary>`. `<html lang="en">` |
| Status messages | Save status, filter result count and banners are announced (`aria-live="polite"`; error banner `role="alert"`). Save status announces "Saved" and problems only, never "Saving…", and never per keystroke (saves wait for an 800 ms pause). Each "Try again" gets `aria-describedby` pointing at its message, so a list of buttons reads "Try again, Couldn't save this tick." rather than many identical "Try again". Counts read as "3 of 7 done" |
| Not colour alone | Chips always carry text; done items have a checked box and a line-through; the current nav item also has a shape (pill or background), not just colour |
| Reflow and zoom | Works at 320 px wide and at 200% text size with no sideways scrolling. Long titles wrap (`overflow-wrap: anywhere` for links and notes) |
| Links that open new tabs | Small "↗" plus visually hidden "(opens in a new tab)"; `rel="noopener noreferrer"` |
| Errors | Field errors are linked with `aria-describedby` and say how to fix them |

Each check is part of the M1 screen review at 390x844 and 1280x900, light and dark.

## 8. UI copy

**Rules**
1. Plain English, sentence case everywhere (headings, buttons, chips are uppercased only by CSS).
2. Short. Buttons are one to three words and start with a verb: "Add note", "Try again", "Sign in with GitHub".
3. Messages say what happened, then what to do. No blame, no "Oops", no exclamation marks, no emoji.
4. No internal words: not "sync", "session", "database", "server", "request", "item id" or error codes. Say "saved", "signed in", "connection".
5. Define jargon once, where it first appears: the sign-in page spells out "Forward Deployed Engineer (FDE)", so later screens can say "FDE". Course and roadmap content keeps its own wording.
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
| Note placeholder, task | "What did you build or learn? Key takeaways, questions, links…" (today's text; other placeholders also stay as today) |
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
| Login: not the owner | "This GitHub account can't sign in. The app is private to its owner." |
| Login: GitHub failed | "Sign-in didn't finish. Try again." |
| Login: after sign-out | "You're signed out." |
| Login: M1 only (sign-in not built yet) | "Sign-in isn't available yet. It comes with saving progress." Link-button: "Go to Home" |
| Not found | "This page doesn't exist." Button: "Go to Home" |
| Example note in screenshots or tests | "Finished the quickstart. Next: try hybrid search on the sample set." with link "https://example.com/demo" |

## Later (not M1 to M3)

**M4 Job applications (sketch only; needs its own design note before build, as the plan says)**
- Route `/applications`. Desktop: sidebar item after Career with an "active" count. Phone: first row of the More sheet.
- Fields: company (required, up to 100 characters), role (required, up to 100), posting link (`https` only), source (select: Company site, Job board, Referral, Recruiter, Other), location (free text, for example "Remote"), status (select, below), applied on (date), next step (up to 120 characters), next step due (date), notes (long text). Created and updated dates are automatic. No fields for other people's contact details (names, emails, phone numbers).
- Statuses and chips: Saved (neutral), Applied, Screening, Interviewing (ok), Offer (now), Rejected, Withdrawn (neutral, row text `muted`). Next step due before today: warn chip "Overdue".
- List, phone: one card per application: company (`body-strong`), role (`small`), status chip, "Next: {next step} · {due date}" with the overdue chip if needed. Desktop: a table with Company, Role, Status, Next step, Due, Updated, sortable by due date. Default sort: due date soonest first, then closed applications last.
- Toolbar: search plus a status filter (All, Active, Closed, then each status). Primary button "Add application" opens a form page; each row opens its edit page; delete needs a confirm step.
- Made-up example row: "Example Corp · AI Engineer · Applied · Next: take-home task · 4 Dec".
- Empty: "No applications yet." Button: "Add application".

**Scaler: open the new current module once.** When the course moves on to the next module, add that module to the stored open list once (and remember that it was added), so the new module is open without undoing the owner's other choices. Today, once anything is stored, the new current module stays closed until the owner opens it, as in the tracker.

**Other ideas, not planned:** a light, dark or system theme switch; a "Jump to current phase" link on `/roadmap`; a sticky toolbar on long pages; search across all sections; the installable phone app from the plan's list; a browser "leave page?" warning while a note change is unsaved, or keeping unsaved note text in the browser until it saves (text typed offline is lost if the page closes first); a "Go to it" action on the save-failed banner that scrolls to the first failed item.
