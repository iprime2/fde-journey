# M5: Insights dashboard (design and scope)

Status: v0.1, 2026-11-26. Scope set by the lead from `PLAN.md` section 13. The owner is busy studying, so the decisions below are defaults they can change. Anything that needs their call is under "Open for the owner".

## Goal
A per-user **Insights** page that shows how their learning is going week by week. It only shows what the app already records, it never shows anyone else's data, and every chart also comes as a table.

## Scope: M5a (this milestone, no migration)
New page `/insights`, signed-in and active users only, behind the same gate as every app page.

1. **This week at a glance.** Completions this week compared with last week, the current weekly streak and the longest one. A streak counts weeks with at least one completion; the current week counts once it has one.
2. **Completions per week.** The last 12 weeks, split by kind:
   - roadmap tasks (`l`);
   - learning resources (`r`);
   - reading (`pp`, `bk`);
   - Scaler classes (`s`), only if Scaler is shown and unlocked for this user;
   - certification prep (`c`);
   - courses (`cr`);
   - projects and career (`p`, `k`), only if those sections are shown.
3. **Active days.** A calendar heatmap of days with any save (a tick, an untick, or a note or link saved) over the last 26 weeks, plus the count of active days in the last 30.
4. **Current phase.**
   - Done and total tasks for the phase whose dates include today, and the days left.
   - A projected finish date at the recent pace (completions over the last 4 weeks). Show it only with at least 2 completions in that window; otherwise say there isn't enough recent activity to project.
5. **Certifications.** For each certification in the user's shown sections: its target date and days left, and prep tasks done out of total.
6. **This month.** Notes saved and learning resources finished since the 1st.

## Rules
- **Weeks** start on Monday, in IST (Asia/Kolkata), the same as Admin's "this week" (M4-DESIGN 10). Personal time zones come later (M5b).
- **Completions** count items that are done now, by the week of their `done_at`. An item ticked and then unticked doesn't count, so the charts always agree with the done counts on every other page.
- **Activity** (the heatmap and active days) reads `progress_event`. Every save writes one row, kept since the M4a release on 2026-11-26. Earlier days use `done_at` only, as a best effort, and the page says so in one line.
- **Hidden or locked sections** never appear: their kinds are left out of the charts and totals. A hidden section's data stays saved.
- **Privacy:**
  - Every query is scoped to the session user, and the static isolation guard covers the new queries.
  - Nothing reads note or link text; only that a note was saved.
  - Admin pages don't change.
- **Charts:**
  - Plain SVG made in React on the server, with no chart library: no new dependency, nothing extra to download, and colours from the existing tokens.
  - Accessible and colour-blind safe: direct labels where they fit, never colour alone, and every chart has a matching table that can be shown.
  - Light and dark, from 320 px to 1920 px, with no sideways scrolling.
  - Motion respects reduced-motion.
- **Empty and new users:** each card has a helpful empty state ("Tick your first item to start your weekly chart"), never a broken or zero-only chart.
- **Speed:** one round of queries per page load (events from the last 26 weeks and the user's progress rows), computed in `lib/insights.ts` as pure, unit-tested functions. The page streams like the other pages.

## Navigation
Insights is always shown, with no Settings switch. In the sidebar it goes right after Home. On phones it goes in More, so nobody's bottom bar changes. Home gets a small "This week: N done · streak N" link to `/insights`; the designer decides where.

## Out of scope for M5a
- **M5b (needs a migration and the owner's yes):** a personal weekly target and time zone in Settings ("Weekly goal" card, DESIGN-SPEC Later).
- **Usage telemetry** (Vercel Web Analytics or Speed Insights): needs a privacy page update and the owner's yes.
- **Phase burn-up line over time:** add later if the 12-week chart isn't enough.
- **Admin-wide insights:** Admin Overview stays as it is.

## Open for the owner (asked later, not blocking M5a)
1. Turn on M5b: a weekly target and a personal time zone?
2. Vercel Web Analytics (page views, no cookies) on the privacy page: yes or no?

## Rules decided during the build (data layer)
1. **Activity window:** 26 whole weeks, Monday to Sunday, ending with this week. The event query starts at 00:00 IST on the first Monday.
2. **Hidden or locked kinds:** left out of activity and the month's note count too, not just the charts. Weekly notes (`journal`) always count. Only ids that exist in the content are counted.
3. **Scaler:** needs to be both shown and unlocked. Locked always wins.
4. **Done with no `done_at`, or a future one:** counts in the phase and certification totals, but in no week.
5. **Estimates from `done_at`:** only for days before 2026-11-26 (IST). From that day on, only events count.
6. **"Notes saved":** counts saves, not distinct notes. Edits and clearing a note both count, because the event can't tell them apart.
7. **Pace:** the last 28 days, today included (IST).
   - Finish date = today + ceil(remaining × 28 / recent).
   - "On track" means the finish date is on or before the phase's end date.
   - A finished phase shows "complete" instead of a projection.
8. **Current phase:** chosen the same way as on Home (`pickCurrentPhase`). Outside every phase's dates, the fallback phase is shown, marked as outside its dates.
9. **Certification target dates:** read from the content's date text.
   - A month, a month range or a day range gives the last day named ("February–March 2027" becomes 31 Mar 2027).
   - Text that names no date ("After joining…") shows no countdown.
   - A test checks that every certification either parses or starts with "After".
10. **Projects and career:** separate kinds, because each has its own section switch.
