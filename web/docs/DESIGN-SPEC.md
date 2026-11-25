# FDE Journey web app: design spec (v0.1)

Status: for M1 and later. Written 2026-11-25 against `PLAN.md` v0.1, which the owner approved on 2026-11-25 (GitHub sign-in for the owner's account only; job applications are the first new section after go-live; four agents plus one skill).
Read with `.claude/skills/journey-app-dev/SKILL.md`. If this spec and the plan disagree, the plan wins; tell the lead.

**What is live when.** Every component below is built in M1 with all its states, so M2 only wires up saving.

| Milestone | Works | Shown but not working yet |
|---|---|---|
| M1 (read-only parity) | Navigation, search, status filter, open and close modules and resource lists, summary tiles, current-phase panel, next class, countdown | Tick boxes and weekly notes are shown disabled. Note buttons are hidden. A "read-only preview" banner explains why (section 6) |
| M2 (sign-in and saving) | Ticks, notes, links, weekly notes, resource ticks, sign-in and sign-out | |

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
@theme inline {
  --color-*: initial;
  --color-page: var(--page); --color-surface: var(--surface); --color-sunk: var(--sunk); --color-hover: var(--hover);
  --color-ink: var(--ink); --color-muted: var(--muted); --color-line: var(--line); --color-line-strong: var(--line-strong);
  --color-accent: var(--accent); --color-accent-hover: var(--accent-hover); --color-accent-ink: var(--accent-ink); --color-accent-soft: var(--accent-soft);
  --color-warn: var(--warn); --color-warn-soft: var(--warn-soft); --color-danger: var(--danger); --color-danger-soft: var(--danger-soft);
  --shadow-overlay: var(--overlay-shadow);
}
```

### 2.4 Typography
Load fonts from npm in the root layout (`import "@fontsource-variable/inter";` and so on). Never `next/font/google` or a Google Fonts link. Package versions were 5.3.0 on npm on 2026-11-25; the front-end engineer pins exact versions.

| Role | Package | `font-family` | Fallback |
|---|---|---|---|
| Display (headings, app name) | `@fontsource-variable/space-grotesk` | `"Space Grotesk Variable"` | `ui-sans-serif, system-ui, sans-serif` |
| Body | `@fontsource-variable/inter` | `"Inter Variable"` | `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` |
| Mono (numbers, counts, dates, chips) | `@fontsource-variable/jetbrains-mono` | `"JetBrains Mono Variable"` | `ui-monospace, SFMono-Regular, Menlo, monospace` |

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

Nothing smaller than 12 px. Body text lines stay under about 75 characters (descriptions `max-w-[65ch]`).

### 2.5 Spacing, radius, shadow, motion, breakpoints
- **Spacing**: Tailwind's default 4 px scale. Use 4, 8, 12, 16, 20, 24, 32, 40, 64 px only. Card padding 16 px; gap between cards 12 px; gap between page sections 20 px (phone) and 24 px (desktop).
- **Radius**: `sm` 6 px (focus ring, chips' inner corners), `md` 10 px (fields, buttons, resource list box), `lg` 12 px (cards, tiles, panels, sheet), `full` (chips, progress bar).
- **Shadow**: cards and tiles have none, only a 1 px `line` border. `shadow-overlay` is only for the "More" sheet.
- **Motion**: 150 ms ease-out for colour changes, 200 ms for caret rotation, 300 ms for progress-bar width. Nothing else moves. Under `prefers-reduced-motion: reduce` all of it is off (use Tailwind's `motion-safe:`), including skeleton pulsing.
- **Breakpoints**: Tailwind defaults. Below `lg` (1024 px) is the phone layout; `md` (768 px) only changes grids. Layouts must also work at 320 px with no sideways scrolling.

## 3. Layout

### 3.1 Phone and tablet (below 1024 px)
- No top bar. The page header is the first thing on screen; pad the top with `max(24px, env(safe-area-inset-top))`.
- **Bottom bar**, fixed: `surface` background, 1 px `line` top border, height 64 px plus `env(safe-area-inset-bottom)`. Five equal cells: **Home, Roadmap, Reading, Scaler, More**. Each cell is a 22 px icon above a `tab-label`, the whole cell is the target (at least 48 px tall). Default colour `muted`. Current page: icon and label `accent`, a 3 px by 24 px `accent` pill above the icon, and `aria-current="page"`.
- **More** is a button (`aria-expanded`, `aria-controls`). It opens a sheet above the bar: `surface`, `lg` top corners, `shadow-overlay`, over a scrim of `rgb(0 0 0 / 0.3)`. Rows 52 px tall: Certifications, Projects, Career, then a divider and Sign out (M2 onwards). It closes on choosing a row, on Escape and on tapping the scrim; focus goes to the first row on open and back to More on close. When the current page is in the sheet, More takes the current style.
- Side padding `max(16px, env(safe-area-inset-left/right))`. Bottom padding 24 px plus the bar height, so the last row is never hidden.

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
Shared rules: focus ring is `outline: 2px solid accent; outline-offset: 2px` on `:focus-visible`, never removed. Disabled means `opacity: 0.5`, `cursor: not-allowed`, and the native `disabled` attribute. Hit areas are at least 44 by 44 px even when the visible shape is smaller (extend with padding or an inset `::before`).

**PageHeader.** Optional eyebrow (`label`, `accent`), `h1` (`display`), optional description (`small`, `muted`, 65ch), optional facts. The `h1` gets `tabindex="-1"` so focus can move to it after navigation. States: default only.

**Facts.** A `<dl>` that wraps: `dt` in `label`/`muted`, `dd` in 14 px Inter 500 `ink`. Gap 8 px by 18 px. Loading: `dd` shows "–" until the client has computed it.

**Banner.** Full-width strip, `md` radius, padding 10 px by 14 px, `small` text, optional action as an underlined text button. Variants: info (`ink` on `sunk`, `role="status"`), warning (`warn` on `warn-soft`, `role="status"`), error (`danger` on `danger-soft`, `role="alert"`). Only info banners can be dismissed. Show at most two, highest first: error, warning, info.

**StatTile.** A link card to its section: `surface`, `line` border, `lg` radius, padding 14 px by 16 px. Number (`num-lg`), label (`small`, `muted`), ProgressBar. Hover: border `line-strong`. Focus: ring. Loading: skeleton. Zero is not special: "0/57" and an empty bar.

**ProgressBar.** 6 px tall, `full` radius, `sunk` track, `accent` fill, width animates (motion rule). `aria-hidden="true"` because the number beside it already says the same.

**StatusChip.** `label` type, padding 3 px by 8 px, `full` radius, always has text. Variants: neutral (`muted` on `sunk`), ok (`accent` on `accent-soft`), now (`accent-ink` on `accent`), warn (`warn` on `warn-soft`). Labels: phases Complete / This phase / Behind / Upcoming; modules Complete / Current / In progress / Not started; certifications Passed or their priority (First, Second, Third, Optional, When eligible, Parked); projects Complete / In progress / Not started.

**Count.** `num`, `muted`, shown as "3/7"; screen readers get "3 of 7 done" (visible text `aria-hidden`, plus a visually hidden span).

**Card.** `surface`, 1 px `line` border, `lg` radius. Head: padding 14 px by 16 px, wrapping row of [title block: `h2` + sub line] [chip] [count]. Optional description (`small`, `muted`, padding 0 16 px 12 px). Body: an item list. Empty: not possible (content files always have items); when filtered, the whole card is hidden.

**CollapsibleCard** (Scaler modules). Native `<details>`/`<summary>`; the summary is the card head with a "›" caret before the title that turns 90° when open. Summary at least 56 px tall. Default: the current module open, the rest closed. Open and closed choices are remembered on the device (`localStorage`, key `fde-open-modules`, same as today). A search or filter match inside forces it open.

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
- Text column: optional index (`num`, `muted`: "M1·01", "1.", "Week of 30 Nov"), title (`body-strong`; a link when the item has a URL, `accent`, underline offset 2 px, opens in a new tab with a small "↗" and visually hidden "(opens in a new tab)"), meta (`small`, `muted`), "why" line (`small`, `muted`).
- States: **default**; **done**: box checked, title `muted` with a line-through (links keep their underline); **focus**: ring around the 20 px box; **read-only** (M1, offline, signed out): box disabled, note button hidden in M1 and enabled elsewhere so notes can still be read; **saving**: none for ticks (they change at once); **save failed**: the tick goes back to its saved value and a line appears under the title in `small` `danger`: "Couldn't save this tick." with a "Try again" text button; **filtered out**: `hidden`.

**NoteButton.** Secondary small button: 32 px visible height inside a 44 px hit area, padding 0 12 px, `md` radius, `small` 500. Labels: "Add note" (1 px `line-strong` border, `muted` text), "Edit note" when a note or link exists (`accent-soft` background, `accent` text, no border), "Hide note" while the editor is open. `aria-expanded` and `aria-controls` point at the editor. Hover: border and text `accent`. Disabled: shared rule.

**NotePreview.** Under the title when a note exists and the editor is closed: `small`, `muted`, keeps line breaks, first 220 characters then "…"; the link on its own line, as a link only if it starts with `https://`.

**NoteEditor.** Opens under the row. A textarea (min 96 px tall, resizes vertically) and a link field (`type="url"`, `inputmode="url"`, placeholder "https://…"), both 16 px, `surface`, 1 px `line-strong` border, `md` radius, padding 10 px 12 px, labels visually hidden: "Note for {title}" and "Link for {title}". A status line (`num`, `muted`, `aria-live="polite"`): "Saving…", then "Saved" (clears after 2.5 s), or "Not saved" in `danger` with a "Try again" button. Saves 800 ms after typing stops and on blur. Opening it focuses the textarea; Escape closes it and returns focus to the NoteButton. Link error (on blur, not empty and not `https://`): border `danger`, message under the field "Links must start with https://", `aria-invalid` and `aria-describedby`; the note text still saves, the link does not. Disabled: fields read-only with the shared disabled look.

**ResourceList** (inside roadmap task rows). A `<details>`: summary "› Learning resources x/y" in `small` 600 `accent`, at least 44 px tall. Inside: "**Start here:** {text}" (`small`, `muted`, label in `ink`), then a list box (`sunk`, 1 px `line` border, `md` radius) of ItemRows (index "1.", linked title, meta "by · type · length · level", why line). Remembered per device (`fde-open-res`). Opens when a search or filter matches inside.

**Toolbar.** One row: SearchField grows, StatusFilter about 150 px; it wraps under 360 px. Gap 8 px.
- SearchField: `type="search"`, 44 px tall, 16 px text, magnifier icon (decorative), label "Search this page" (visually hidden), placeholder per page (section 8). Matches titles, meta, why lines, resource titles, note text and links.
- StatusFilter: native `<select>`, 44 px, label "Show" (visually hidden): All items, Not done, Done, With notes.
- Both stored in the URL (`?q=` and `?status=`, replace, don't push) so reload and Back keep them. A visually hidden live region says "{n} items shown" 400 ms after the last change.

**EmptyState.** Centred `small` `muted` text on `surface` with a 1 px dashed `line` border, `lg` radius, padding 28 px, plus an optional secondary button. Examples in section 8.

**Skeleton.** `sunk` blocks with `sm` radius in the shape of the content. Pulses (opacity 1 to 0.6, 1.2 s) only with `motion-safe`. The wrapper has `aria-busy="true"` and a visually hidden "Loading".

**Button.** 44 px tall, `md` radius, padding 0 16 px, `body-strong`. Primary: `accent` / `accent-ink`, hover `accent-hover`. Secondary: `surface`, 1 px `line-strong` border, `ink`, hover `hover`. Ghost: no border, `muted` text, hover `hover` background and `ink` text. Loading: label changes (for example "Opening GitHub…"), `aria-busy`, disabled. Disabled: shared rule.

**GroupLabel.** `label`, `muted`, 8 px top margin ("Core modules", "Elective modules"). Hidden when nothing under it matches the filter.

**NowPanel** (Home). A card with two parts. Left: kicker "Roadmap · {phase dates}" (`label`, `muted`), `h2` "Phase {n} · {title}" plus StatusChip, "x/y tasks done" (`num`), ProgressBar; then kicker "Scaler · Module {n}", "{title}: {subtitle}", "x/y classes · next: {class}". Right: kicker "Up next this phase" and the first three tasks not yet done, each a link to `/roadmap#item-{id}` with an `accent` "→". Empty: "All tasks in this phase are done."

**JournalEditor** (Weekly notes on Career). Card head "Weekly notes" with its sub line; one textarea (min 160 px) labelled by the card heading; status line and saving as in NoteEditor.

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
4. Card "Research papers" (sub line as today, Count): rows with index "Week of {date}", linked title, meta "{authors} · Core or Optional", plus " · This week" for the current week, and the why line.
5. Card "Books" (sub line as today, Count): linked title, meta "{by} · Core or Optional", why line.

**`/scaler`**
1. PageHeader: `h1` "Scaler course"; description "14 modules: 10 core and 4 electives."; facts "Classes: Mon · Wed · Fri, 09:00–11:30 IST" and "Next class: {value}".
2. Banners. 3. Toolbar.
4. GroupLabel "Core modules", CollapsibleCards for modules 1 to 10; GroupLabel "Elective modules", modules 11 to 14. Summary: "Module {n} · {title}", sub "{subtitle} · {months} mo · {k} classes", StatusChip, Count. Rows: index "M{n}·{01}", title, no meta.

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
- Primary button, full width: GitHub mark plus "Sign in with GitHub". Loading: "Opening GitHub…".
- Banner area under the button for the messages in section 8.

## 6. States

| State | When | What the owner sees | Behaviour |
|---|---|---|---|
| Read-only preview | M1 only | Info banner on every page: "Read-only preview. Ticks and notes can't be saved yet." | Tick boxes and weekly notes disabled, note buttons hidden. Search, filter, open and close, tiles and countdown work |
| Signed out | Any page without a valid sign-in | Nothing from the page; goes straight to `/login?next={path}` | After sign-in, return to `next`. No flash of content |
| Not the owner | Sign-in with another GitHub account | `/login` with the "not allowed" error | No account is kept for that user |
| Signed out while using | A save is refused for sign-in reasons | Error banner with a "Sign in" action | Write controls disabled; typed note text stays in place until the page is left |
| First visit, no progress | No progress saved yet | Zeros and empty bars; NowPanel shows today's phase with its first three tasks; info banner on Home only | Banner disappears once anything is saved (based on data, not a dismiss) |
| Loading | A page is waiting for data | Skeleton: header block, toolbar block, three cards of four rows. After 3 s add the "still loading" line | Navigation stays usable. The free database sleeps after 5 idle minutes, so the first load can be slow |
| Saving | Tick or note change | Ticks change at once; notes show "Saving…" | Ticks are optimistic |
| Save failed | A save errors | Inline message on the item and one error banner for the page | Tick goes back to its saved value; note text is kept. Banner stays until every failed item is saved or the page is left |
| Offline | Browser reports offline | Warning banner | Write controls disabled; reading, search and filter still work. A save in flight counts as failed. Back online: info banner for 4 s, controls enabled again |
| Page error | Server error while rendering | Card "This page didn't load." with "Try again" (primary) and "Go to Home" (secondary) | `error.tsx` per route group |
| Not found | Unknown address | "This page doesn't exist." and "Go to Home" | `not-found.tsx` |

## 7. Accessibility
The conventions checklist, applied:

| Check | How it applies here |
|---|---|
| Text contrast at least 4.5:1 | Every text pair in 2.2 passes in both schemes; lowest 4.52. Field borders, tick boxes, focus ring and progress fill are 3:1 or more |
| Visible focus | 2 px `accent` ring with 2 px offset on every interactive element, including summaries, tiles, nav links and the tick box. Never `outline: none` without a replacement |
| Full keyboard use | Skip link "Skip to content" first on every page. Tab order follows reading order. Space ticks; Enter and Space open and close summaries; Escape closes the More sheet and the note editor. After client navigation, focus moves to the page `h1` |
| Labelled controls | Tick boxes "Mark done: {title}" (contains the visible title). Search, filter, note and link fields have labels (visually hidden is fine). Icon-only controls do not exist; bottom-bar icons sit above visible labels |
| Touch targets at least 44 px | Tick cell 44 by 44; note button, summaries, fields, select, buttons, nav links 44 px; bottom-bar cells 48 px; More sheet rows 52 px |
| Reduced motion | All transitions and the skeleton pulse are off under `prefers-reduced-motion` |
| Structure | Landmarks: `nav` (sidebar or bottom bar, "Sections"), `main`. One `h1` per page; cards use `h2`. `<html lang="en">` |
| Status messages | Save status, filter result count and banners are announced (`aria-live="polite"`; error banner `role="alert"`). Counts read as "3 of 7 done" |
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
5. Define a term the first time it appears on a screen: "Forward Deployed Engineer (FDE)". Course and roadmap content keeps its own wording.
6. Dates like the tracker: "Mon 30 Nov", "24 Nov – 1 Dec 2026", "15 Feb 2027". Times in 24-hour IST: "09:00 IST". Numbers as digits.
7. Keep the tracker's labels for anything that already exists, so the owner recognises it.

**Examples** (made-up content where content is needed)

| Situation | Copy |
|---|---|
| Search placeholder, roadmap | "Search tasks, resources, notes…" |
| Search placeholder, Scaler | "Search classes and notes…" |
| Search placeholder, reading | "Search papers, books, notes…" |
| Note placeholder, task | "What did you build or learn? Key takeaways, questions, links…" (today's text; other placeholders also stay as today) |
| Link placeholder | "https://…" |
| No matches | "Nothing matches this search or filter." Button: "Clear search and filter" |
| "With notes" and no notes yet | "No notes yet. Use Add note on any item." |
| First visit banner (Home) | "Nothing ticked yet. Tick items as you finish them and your progress will show here." |
| Read-only preview (M1) | "Read-only preview. Ticks and notes can't be saved yet." |
| Still loading (after 3 s) | "Still loading. The first load after a quiet spell can take a few seconds." |
| Note status | "Saving…" / "Saved" / "Not saved" + "Try again" |
| Tick failed (inline) | "Couldn't save this tick." + "Try again" |
| Save failed (banner) | "A change wasn't saved. Check your connection, then use Try again next to it." |
| Link not https | "Links must start with https://" |
| Offline | "You're offline. You can read and search, but changes won't save until you're back online." |
| Back online | "Back online." |
| Signed out while using | "You were signed out, so that change wasn't saved." Action: "Sign in" |
| Login: not the owner | "This GitHub account can't sign in. The app is private to its owner." |
| Login: GitHub failed | "Sign-in didn't finish. Try again." |
| Login: after sign-out | "You're signed out." |
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

**Other ideas, not planned:** a light, dark or system theme switch; a "Jump to current phase" link on `/roadmap`; a sticky toolbar on long pages; search across all sections; the installable phone app from the plan's list.
